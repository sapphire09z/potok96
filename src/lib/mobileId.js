
import { createHmac } from "node:crypto";

const API_BASE = "https://midsdk.smsaero.ru";

export async function mobileIdRequest(
    endpoint,
    signatureValue,
    extraFields = {}
) {
    const clientId = process.env.SMSAERO_CLIENT_ID;
    const apiSecret = process.env.SMSAERO_API_SECRET;

    if (!clientId || !apiSecret) {
        throw new Error("Mobile ID credentials are not configured");
    }

    const timestamp = String(Math.floor(Date.now() / 1000));

    const signature = createHmac("sha256", apiSecret)
        .update(clientId + signatureValue + timestamp)
        .digest("hex");

    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_id: clientId,
            ...extraFields,
            timestamp,
            signature,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
    });

    const data = await response.json().catch(() => null);

    return {
        ok: response.ok,
        status: response.status,
        data,
    };
}
