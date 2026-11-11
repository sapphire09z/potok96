import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_IMAGE_LIMIT, EVENT_IMAGE_SIZES, eventImageKey, eventImageMetadata,
    canDisplayEventImage } from "../src/lib/eventMediaPolicy.mjs";

const id = "cmhlg4cb20001o30owidpb1fl";
const imageId = "123e4567-e89b-42d3-a456-426614174000";
const photo = { id: imageId, eventId: id,
    storageKey: `media/events/${id}/${imageId}`, credit: "Редакция", rightsNote: "Собственная фотография" };

test("S3 event keys are scoped by immutable IDs and protected against tampering", () => {
    assert.equal(eventImageKey(id, photo), photo.storageKey);
    assert.throws(() => eventImageKey(id, { ...photo, storageKey: "media/orgs/elsewhere" }));
    assert.throws(() => eventImageKey("../evil", photo));
    assert.throws(() => eventImageKey(id, { ...photo, id: "../exploit" }));
    assert.deepEqual(EVENT_IMAGE_SIZES, [320, 640, 960, 1440]);
    assert.equal(EVENT_IMAGE_LIMIT, 8);
});

test("media attribution input accepts exactly known keys and limits lengths", () => {
    assert.deepEqual(eventImageMetadata({ action: "metadata", caption: " Афиша ",
        credit: "Автор", rightsNote: "Разрешение автора" }),
        { caption: "Афиша", credit: "Автор", rightsNote: "Разрешение автора" });
    assert.equal(eventImageMetadata({ action: "metadata", caption: "", credit: "", rightsNote: "", role: "ADMIN" }), null);
    assert.equal(eventImageMetadata({ action: "metadata", caption: "x".repeat(241), credit: "", rightsNote: "" }), null);
    assert.equal(eventImageMetadata({ action: "metadata", caption: "", credit: "\u202eevil", rightsNote: "" }), null);
    assert.equal(eventImageMetadata({ action: "cover", caption: "", credit: "", rightsNote: "" }), null);
});

test("public cover requires matching event and both rights fields", () => {
    assert.equal(canDisplayEventImage({ id }, photo), true);
    assert.equal(canDisplayEventImage({ id }, { ...photo, rightsNote: " " }), false);
    assert.equal(canDisplayEventImage({ id }, { ...photo, credit: null }), false);
    assert.equal(canDisplayEventImage({ id: "cmhlg4cb20001o30owidpb1fe" }, photo), false);
    assert.equal(canDisplayEventImage({ id }, { ...photo, storageKey: "media/events/fake" }), false);
});
