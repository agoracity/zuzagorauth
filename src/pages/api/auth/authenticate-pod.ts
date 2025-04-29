import { generatePodSignature } from "@/utils/generatePodSignature";
import { withIronSessionApiRoute } from "iron-session/next";
import { NextApiRequest, NextApiResponse } from "next";

const authPodRoute = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { proof, originalSso } = req.body;

    // Validate the proof from Zupass
    if (!proof?.revealedClaims?.pods?.emailPod?.entries?.emailAddress?.value) {
      return res.status(400).json({ message: "Invalid proof format" });
    }

    // Extract email from proof - updated path to match the actual structure
    const email = proof.revealedClaims.pods.emailPod.entries.emailAddress.value;
    
    // Validate pod type to ensure it's a zupass email
    const podType = proof.revealedClaims.pods.emailPod.entries.pod_type.value;
    if (podType !== "zupass.email") {
      return res.status(400).json({ message: "Invalid pod type" });
    }

    // Get the signer public key for additional verification if needed
    const signerPublicKey = proof.revealedClaims.pods.emailPod.signerPublicKey;
    
    // Generate new SSO payload and signature using the POD-specific function
    const { encodedPayload, signature } = await generatePodSignature(
      email,
      req.session?.nonce || "" 
    );

    const finalResponse = {
      attendeeEmail: email,
      encodedPayload,
      sig: signature,
      status: 200
    };

    res.status(200).json(finalResponse);

  } catch (error: any) {
    console.error(`[ERROR] ${error.message}`);
    res.status(500).json({ message: `Unknown error: ${error.message}` });
  }
};

// Use the same iron session options as before
const ironOptions = {
  cookieName: process.env.SESSION_COOKIE_NAME as string,
  password: process.env.SESSION_PASSWORD as string,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production"
  }
};

export default withIronSessionApiRoute(authPodRoute, ironOptions);