// src/utils/generatePodSignature.ts
import crypto from "crypto";
import { toUrlEncodedString } from "./toUrl";

export const generatePodSignature = async (
  email: string,
  nonce: string
) => {
  try {
    const payload = {
      nonce: nonce,
      email: email,
      external_id: email, // Using email as external_id for now
      add_groups: "generic" // Using generic group as requested
    };

    // Encoding payload to Base64
    const urlPayload = toUrlEncodedString(payload);
    const encodedPayload = Buffer.from(urlPayload).toString("base64");

    const secret = process.env.DISCOURSE_CONNECT_SECRET;

    if (typeof secret !== "string") {
      throw new Error(
        "You need to set DISCOURSE_CONNECT_SECRET as an environment variable."
      );
    }

    // Compute the HMAC-SHA256
    const signature = crypto
      .createHmac("sha256", secret)
      .update(encodedPayload)
      .digest("hex");

    return { encodedPayload, signature };
  } catch (error) {
    console.error("There was an error generating the signature:", error);
    throw new Error("There was an error generating the signature.");
  }
};