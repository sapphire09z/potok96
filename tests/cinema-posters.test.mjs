import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { chooseCinemaPoster, cinemaPosterObjectKey, cinemaPosterPublicUrl } from "../src/lib/cinemaPosterPolicy.mjs";
import { fetchCinemaPoster, synchronizeCinemaPosters } from "../src/lib/cinemaPosters.mjs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SID = "123e4567-e89b-42d3-a456-426614174000";
const PNG = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(20)]);
const HASH = createHash("sha256").update(PNG).digest("hex");
const movie = () => ({ externalId: 1196, title: "Морозко", isCurrent: true,
    media: [{ id: 3314, typeId: 10, fileName: "3314.mp4" }, { id: 3315, typeId: 1, fileName: "3315.jpg" }],
    posterMediaId: null, posterKey: null, posterHash: null,
    updatedAt: new Date("2026-11-17T08:00:00Z") });
const fetchFn = async (url, opts) => {
    assert.match(url, new RegExp(`^http://37\\.79\\.202\\.93/CinemaWebApi/api/${SID}/mediaData\\?id=3315$`));
    assert.equal(opts.method, "GET");
    assert.equal(opts.redirect, "error");
    return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
};
function db(row = movie()) {
    let writes = 0;
    const prisma = { cinemaMovie: {
        async findMany() { return [row]; },
        async updateMany({ where, data }) {
            writes++;
            if (where.updatedAt !== row.updatedAt) return { count: 0 };
            Object.assign(row, data);
            return { count: 1 };
        },
    } };
    return { prisma, row, getWrites: () => writes };
}
const transform = async () => Buffer.from("transcoded-webp");

test("Poster selection excludes TypeId=10 trailers and rejects other formats", () => {
    assert.equal(chooseCinemaPoster(movie().media).id, 3315);
    assert.equal(chooseCinemaPoster([{id: 3, typeId: 10, fileName: "x.mp4"}]), null);
    assert.equal(chooseCinemaPoster([{id: 3, typeId: 1, fileName: "image.svg"}]), null);
    assert.equal(chooseCinemaPoster([{id: 4, typeId: 1, fileName: "a.png"},{id: 5, typeId: 1, fileName: "b.jpg"}]).id, 5);
});

test("Immutable poster keys include movie, media, and source SHA-256", () => {
    const key = cinemaPosterObjectKey(1196, 3315, HASH);
    assert.match(key, /^media\/cinema\/1196\/3315-[0-9a-f]{32}\.webp$/);
    assert.throws(() => cinemaPosterObjectKey(0, 3315, HASH));
    assert.throws(() => cinemaPosterObjectKey(1196, 3315, "bad"));
});

test("Only own CDN and matching movie/media ID can become a public poster", () => {
    const row = { ...movie(), posterMediaId: 3315, posterKey: cinemaPosterObjectKey(1196,3315,HASH) };
    assert.equal(cinemaPosterPublicUrl(row,"https://media-staging.potok96.ru"), `https://media-staging.potok96.ru/${row.posterKey}`);
    assert.equal(cinemaPosterPublicUrl({ ...row, posterMediaId: 3314 },"https://media-staging.potok96.ru"), "");
    assert.equal(cinemaPosterPublicUrl({ ...row, posterKey: "media/news/test.webp" },"https://media-staging.potok96.ru"), "");
    assert.equal(cinemaPosterPublicUrl(row,"http://malicious.test"), "");
});

test("Media GET accepts bounded binary image and never uses mutation endpoints", async () => {
    assert.deepEqual(await fetchCinemaPoster(SID,3315,fetchFn), PNG);
    await assert.rejects(fetchCinemaPoster(SID,3315,async () => new Response("{}", {status:200})), /JPEG or PNG/);
    await assert.rejects(fetchCinemaPoster(SID,3315,async () => new Response("denied", {status:403})), /HTTP 403/);
});

test("Dry-run validates input but never uploads or writes PostgreSQL", async () => {
    const d = db(); let uploads=0;
    const s = await synchronizeCinemaPosters({prisma:d.prisma,serviceId:SID,apply:false,
        fetchFn, transform,upload:async()=>{uploads++}});
    assert.equal(s.changed,1);
    assert.equal(s.failures,0);
    assert.equal(uploads,0);
    assert.equal(d.getWrites(),0);
});

test("Apply publishes S3 object before moving database pointer; rerun skips upload", async () => {
    const d = db(); const order=[];
    const orig = d.prisma.cinemaMovie.updateMany;
    d.prisma.cinemaMovie.updateMany = async args => { order.push("db"); return orig(args); };
    const run = () => synchronizeCinemaPosters({ prisma:d.prisma,serviceId:SID,apply:true,
        fetchFn,transform,upload:async(k,b,t)=>{order.push("s3");assert.match(k,/media\/cinema/);assert.equal(t,"image/webp");} });
    const s = await run();
    assert.deepEqual(order,["s3","db"]);
    assert.equal(s.changed,1);
    assert.equal(d.row.posterMediaId,3315);
    assert.equal(d.row.posterHash,HASH);
    const again = await run();
    assert.equal(again.unchanged,1);
    assert.deepEqual(order,["s3","db"]);
});

test("Upload error preserves existing database pointer and records failure", async () => {
    const d = db(); const s = await synchronizeCinemaPosters({ prisma:d.prisma,serviceId:SID,apply:true,
        fetchFn,transform,upload:async()=>{throw new Error("S3 failed")},logger:{error(){}} });
    assert.equal(s.failures,1);
    assert.equal(d.row.posterKey,null);
    assert.equal(d.getWrites(),0);
});

test("No supported poster produces placeholder and removes stale pointer only on apply", async () => {
    const row = {...movie(),media:[{id:3314,typeId:10,fileName:"3314.mp4"}],
        posterMediaId:3315,posterKey:cinemaPosterObjectKey(1196,3315,HASH),posterHash:HASH};
    const d=db(row);
    const s=await synchronizeCinemaPosters({prisma:d.prisma,serviceId:SID,apply:false,transform});
    assert.equal(s.missing,1); assert.equal(d.getWrites(),0);
    await synchronizeCinemaPosters({prisma:d.prisma,serviceId:SID,apply:true,transform,upload:async()=>{}});
    assert.equal(row.posterKey,null);
});

test("Docker service is one-shot and uses both protected env files", () => {
    const compose = read("compose.yaml");
    const docker = read("Dockerfile.migrate");
    assert.match(compose,/cinema-posters:[\s\S]+?profiles: \["tools"\]/);
    assert.match(compose,/cinema-posters:[\s\S]+?\/opt\/potok96-deploy\/cinema\.env/);
    assert.match(compose,/cinema-posters:[\s\S]+?\/opt\/potok96-deploy\/s3\.env/);
    assert.match(docker,/COPY src\/lib\/media\/s3\.js/);
    assert.match(docker,/COPY src\/lib\/cinemaPosters\.mjs/);
    assert.doesNotMatch(read("scripts/sync-cinema-posters.mjs"),/\bPOST\b|\/sale\//);
});

test("Cinema public page already has poster rendering; catalogue maps only verified key", () => {
    const cat = read("src/lib/cinemaCatalog.mjs");
    const page = read("src/app/events/cinema/page.js");
    const s3 = read("src/lib/media/s3.js");
    assert.match(cat,/poster: cinemaPosterPublicUrl\(row\)/);
    assert.match(page,/<Image/);
    assert.match(s3,/\|cinema\)/);
});
