/* 
Dev note :
In the future we could  emit POD's of the PCD's that we receive from the user.
This would allow to remove the need to offer two different flows (email and ticket). */
/* 
TO DO 's :
Remove unused Components and code
Add valid types and remove any types and interfaces that are not used
*/
"use client";

import { useZupass } from "@/zupass";
import { Zapp, connect } from "@parcnet-js/app-connector";
import { useZupassPopupMessages } from "@pcd/passport-interface";
import { SerializedPCD } from "@pcd/pcd-types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OuterContainer, PageContainer } from "../components/Zuzagora";
import { Button } from "../components/core/Button";
import { validateSSO } from "../utils/validateSSO";

/**
 * Zupass Application Configuration
 * 
 * This defines the permissions our app needs from Zupass:
 * - REQUEST_PROOF: Allows requesting email proofs from users
 * - READ_POD: Enables reading email Proof of Data (POD)
 * - READ_PUBLIC_IDENTIFIERS: Allows access to public identifiers
 * 
 * PODs (Proof of Data) are cryptographic proofs that allow users to prove
 * they own certain data (like an email) without revealing the actual data
 */
const myZapp: Zapp = {
  name: "Agora Auth Zapp",
  permissions: {
    REQUEST_PROOF: { collections: ["Email"] },    
    READ_POD: { collections: ["Email"] },         
    READ_PUBLIC_IDENTIFIERS: {}                   
  }
}

/**
 * SSO Parameters Interface
 * 
 * Defines the structure of Single Sign-On (SSO) parameters:
 * - sso: Base64 encoded payload with auth data
 * - sig: Cryptographic signature to verify SSO payload
 * - return_sso_url: URL to redirect after successful auth
 * - nonce: One-time token to prevent replay attacks
 */
interface SSOParams {
  sso: string;               
  sig: string;               
  return_sso_url?: string;   
  nonce?: string;            
  [key: string]: any;        
}

function Page() {
  /**
   * State Management
   * 
   * loading: Tracks authentication process status
   * connectorRef: References DOM element for Zupass connector
   * searchParams: Access to URL query parameters
   * inputParams: Stores validated SSO parameters
   * emailProofSuccess: Tracks if email proof was successful
   * proofResult: Stores the result of email proof
   * authMode: Tracks current authentication flow ('email' or 'ticket')
   */
  const [loading, setLoading] = useState(false);
  const connectorRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const [inputParams, setInputParams] = useState<any>(null);
  const [emailProofSuccess, setEmailProofSuccess] = useState(false);
  const [proofResult, setProofResult] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'email' | 'ticket' | null>(null);

  // Zupass hooks for ticket verification
  const { login } = useZupass();
  const [pcdStr, _pendingPCDStr, multiPCDs] = useZupassPopupMessages();


  /**
   * SSO Validation Effect
   * 
   * Runs when component mounts or URL parameters change
   * 1. Extracts SSO parameters from URL
   * 2. Validates SSO signature and payload
   * 3. Stores validated parameters for later use
   */
  useEffect(() => {
    async function startValidation() {
      try {
        if (!searchParams) return;
        
        const sso = searchParams.get("sso");
        const sig = searchParams.get("sig");
        
        if (!sso || !sig) {
          setInputParams(null);
          return;
        }

        const params: SSOParams = { sso, sig };
        const response = await validateSSO(sso, sig);
        
        if (response?.isValid) {
          setInputParams({ ...params, ...response });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }

    startValidation();
  }, [searchParams]);


  /**
   * PCD Processing Effect
   * 
   * Handles Proof Carrying Data (PCD) when received from Zupass
   * PCDs are cryptographic proofs that verify user claims
   */
  useEffect(() => {
    if (multiPCDs) {
      processProof(multiPCDs);
    }
  }, [multiPCDs]);

  /**
   * Email Authentication Handler
   * 
   * Main flow for email-based authentication:
   * 1. Connects to Zupass client
   * 2. Requests email proof from user
   * 3. Processes the proof result
   * 4. Updates UI state on success
   */
  const handleLogin = async () => {
    if (!connectorRef.current) return;
    setLoading(true);
    
    try {
      // Connect to Zupass
      const clientUrl = "https://zupass.org";
      const z = await connect(myZapp, connectorRef.current, clientUrl);

      // Request email proof
      const result = await z.gpc.prove({
        request: {
          pods: {
            emailPod: {
              pod: {
                entries: {
                  emailAddress: { type: "string" },
                  semaphoreV4PublicKey: { type: "eddsa_pubkey" },
                  pod_type: { type: "string" }
                }
              },
              revealed: { 
                emailAddress: true,
                semaphoreV4PublicKey: true,
                pod_type: true
              }
            }
          }
        }
      });

      setProofResult(result);
      setEmailProofSuccess(true);
      setAuthMode('email');

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Ticket Proof Handler
   * 
   * Alternative authentication flow using tickets:
   * 1. Initiates ticket-based login
   * 2. Processes ticket proof through Zupass
   * 3. Handles popup closure gracefully
   */
  const handleTicketProof = async () => {
    setLoading(true);
    setAuthMode('ticket');
    try {
      const result = await login(inputParams);
      if (result?.type === 'popupClosed') {
        setLoading(false); // Re-enable the button if popup was closed
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  /**
   * Proof Processing Function
   * 
   * Handles the verification of received proofs:
   * 1. Sends proof to backend for verification
   * 2. Processes authentication response
   * 3. Redirects user on successful verification
   */
  const processProof = async (multiPCDs: SerializedPCD[]) => {
    try {
      // Send proof to backend for verification
      const response = await fetch('/api/auth/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(multiPCDs)
      });

      const authResponse = await response.json();
      const returnSSOURL = inputParams?.return_sso_url;

      // Handle successful authentication
      if (authResponse && returnSSOURL) {
        const redirectURL = `${returnSSOURL}?sso=${authResponse?.encodedPayload}&sig=${authResponse?.sig}`;
        window.location.href = redirectURL;
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  /**
   * Agora Continuation Handler
   * 
   * Final step in email authentication flow:
   * 1. Validates proof result and SSO parameters
   * 2. Sends proof to backend for POD authentication
   * 3. Redirects to Agora with authenticated session
   */
  const handleContinueToAgora = async () => {
    if (!proofResult || !inputParams?.sso) {
      console.error("Missing proof result or SSO parameters");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/authenticate-pod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          proof: proofResult,
          originalSso: inputParams.sso
        })
      });

      const authResponse = await response.json();

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

  /**
   * UI Rendering
   * 
   * Renders authentication interface with two main states:
   * 1. Initial state: Shows email sign-in button
   * 2. Post-email-proof: Shows continue to Agora and ticket proof options
   * 
   * The UI adapts based on authentication state and loading status
   */
  return (
    <OuterContainer>
      <PageContainer>
        {/* Main container with centered content */}
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          {/* Show error message if no SSO params */}
          {!inputParams ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px'
            }}>
              <img className="logo-image" src="logoicon.png" alt="agora logo" />
              <p style={{ color: '#1B4332', fontSize: '16px' }}>
                Invalid login attempt. Please return to Agora and try again.
              </p>
              <Button
                onClick={() => window.location.href = 'https://www.agora.city/login'}
                customStyle={{
                  padding: '12px 24px',
                  backgroundColor: '#FFD166',
                  border: 'none',
                  borderRadius: '100px',
                  color: '#1B4332',
                  fontSize: '16px'
                }}
              >
                Return to Agora
              </Button>
            </div>
          ) : (
            <>
              {/* Logo shown only before email proof */}
              {!emailProofSuccess && (
                <>
                  <div className="flex-col" style={{ justifyContent: "center" }}>
                    <img className="logo-image" src="logoicon.png" alt="agora logo" />
                  </div>
                </>
              )}

              {/* Zupass connector mount point */}
              <div ref={connectorRef} />
              
              {/* Conditional rendering based on email proof status */}
              {!emailProofSuccess ? (
                // Initial email sign-in button
                <Button 
                  onClick={handleLogin} 
                  disabled={loading}
                  customStyle={{
                    width: '320px',
                    padding: '12px',
                    backgroundColor: '#FFD166',
                    border: 'none',
                    borderRadius: '100px',
                    color: '#1B4332',
                    fontSize: '16px'
                  }}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              ) : (
                // Post-email-proof options
                <div style={{ 
                  width: '320px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {/* Continue to Agora button */}
                  <Button 
                    onClick={handleContinueToAgora}
                    disabled={loading}
                    customStyle={{ 
                      width: '100%',
                      padding: '16px',
                      backgroundColor: '#FFD166',
                      border: 'none',
                      borderRadius: '100px',
                      color: '#1B4332',
                      fontSize: '18px',
                      fontWeight: '500'
                    }}
                  >
                    Continue to Agora City
                  </Button>
                  
                  {/* Ticket proof option */}
                  <Button 
                    onClick={handleTicketProof}
                    disabled={loading}
                    customStyle={{ 
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'transparent',
                      border: '1px solid #FFD166',
                      borderRadius: '100px',
                      color: '#1B4332',
                      fontSize: '14px',
                      opacity: '0.8'
                    }}
                  >
                    Prove a Ticket
                  </Button>
                </div>
              )}

              {/* Help link */}
              <Link
                href="https://t.me/petrafran"
                target="_blank"
                style={{ 
                  color: '#1B4332',
                  textDecoration: 'none',
                  fontSize: '14px',
                  marginTop: '24px',
                  opacity: '0.7'
                }}
              >
                I'm having trouble connecting
              </Link>
            </>
          )}
        </div>
      </PageContainer>
    </OuterContainer>
  );
}

export default Page;