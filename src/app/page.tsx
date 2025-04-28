"use client";

import { Zapp, connect } from "@parcnet-js/app-connector";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OuterContainer, PageContainer } from "../components/Zuzagora";
import { Button } from "../components/core/Button";
import { validateSSO } from "../utils/validateSSO";

// Define the Zupass application configuration for email verification
// This specifies what permissions our app needs from Zupass
const myZapp: Zapp = {
  name: "Agora Auth Zapp",
  permissions: {
    REQUEST_PROOF: { collections: ["Email"] },    // Permission to request email proof from user
    READ_POD: { collections: ["Email"] },         // Permission to read email PODs (Proof of Data)
    READ_PUBLIC_IDENTIFIERS: {}                   // Permission to read public identifiers
  }
}

// Interface defining the structure of SSO parameters received and handled by the application
interface SSOParams {
  sso: string;                // Base64 encoded payload containing authentication data
  sig: string;                // Signature to verify the authenticity of the SSO payload
  return_sso_url?: string;    // URL to return to after successful authentication
  nonce?: string;             // One-time use value to prevent replay attacks
  [key: string]: any;         // Allow for additional dynamic properties
}

function Page() {
  // State to manage loading status during authentication process
  const [loading, setLoading] = useState(false);
  
  // Reference to the DOM element where Zupass connector will be mounted
  const connectorRef = useRef<HTMLDivElement>(null);
  
  // Hook to access URL search parameters
  const searchParams = useSearchParams();
  
  // State to store validated SSO parameters and additional data
  const [inputParams, setInputParams] = useState<any>(null);

  // Effect hook to validate SSO parameters when the component mounts or URL parameters change
  useEffect(() => {
    async function startValidation() {
      try {
        if (!searchParams) return;
        
        // Extract SSO parameters from URL
        const sso = searchParams.get("sso");
        const sig = searchParams.get("sig");
        
        // Only proceed with validation if both SSO and signature are present
        if (!sso || !sig) return;

        const params: SSOParams = { sso, sig };
        
        // Validate the SSO parameters using backend service
        const response = await validateSSO(sso, sig);
        
        // If validation successful, store the parameters and validation response
        if (response?.isValid) {
          setInputParams({ ...params, ...response });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }

    startValidation();
  }, [searchParams]);

  // Handler for the login button click
  const handleLogin = async () => {
    // Ensure the connector reference exists
    if (!connectorRef.current) return;
    setLoading(true);
    
    try {
      // Connect to Zupass using the app configuration
      const clientUrl = "https://zupass.org";
      const z = await connect(myZapp, connectorRef.current, clientUrl);

      // Request proof of email ownership from Zupass
      // This opens the Zupass popup for the user to approve the proof request
      const result = await z.gpc.prove({
        request: {
          pods: {
            emailPod: {
              pod: {
                // Define the structure of the email proof we need
                entries: {
                  emailAddress: { type: "string" },
                  semaphoreV4PublicKey: { type: "eddsa_pubkey" },
                  pod_type: { type: "string" }
                }
              },
              // Specify which fields should be revealed in the proof
              revealed: { 
                emailAddress: true,
                semaphoreV4PublicKey: true,
                pod_type: true
              }
            }
          }
        }
      });

      // Ensure we have the necessary SSO parameters before proceeding
      if (!inputParams?.sso) {
        throw new Error("Missing SSO parameters");
      }

      // Send the proof to our backend for validation and SSO token generation
      const response = await fetch('/api/auth/authenticate-pod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          proof: result,
          originalSso: inputParams.sso
        })
      });

      const authResponse = await response.json();

      // If authentication successful, redirect back to the original site with new SSO parameters
      if (authResponse.encodedPayload && authResponse.sig && inputParams?.return_sso_url) {
        const redirectURL = `${inputParams.return_sso_url}?sso=${authResponse.encodedPayload}&sig=${authResponse.sig}`;
        window.location.href = redirectURL;
      }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Render the authentication interface
  return (
    <OuterContainer>
      <PageContainer>
        <div className="flex-col" style={{ justifyContent: "center" }}>
          <img className="logo-image" src="logoicon.png" alt="agora logo" />
          {/* Div where Zupass connector will be mounted */}
          <div ref={connectorRef} />
          {/* Login button that triggers the Zupass authentication flow */}
          <Button 
            onClick={handleLogin} 
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </div>
        {/* Support link for users having trouble */}
        <Link
          href="https://t.me/petrafran"
          target="_blank"
          style={{ color: "var(--bg-dark-primary)", margin: 15 }}
        >
          I'm having trouble connecting
        </Link>
      </PageContainer>
    </OuterContainer>
  );
}

export default Page;