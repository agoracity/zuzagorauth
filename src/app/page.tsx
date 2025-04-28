"use client";

import { Zapp, connect } from "@parcnet-js/app-connector";
import * as p from "@parcnet-js/podspec";
import Link from "next/link";
import { useRef, useState } from "react";
import { OuterContainer, PageContainer } from "../components/Zuzagora";
import { Button } from "../components/core/Button";

const myZapp: Zapp = {
  name: "Email Proof Zapp",
  permissions: {
    REQUEST_PROOF: { collections: ["Email"] },
    READ_POD: { collections: ["Email"] },
    READ_PUBLIC_IDENTIFIERS: {}
  }
}

function Page() {
  const [loading, setLoading] = useState(false);
  const [proofResult, setProofResult] = useState<any>(null);
  const [emailPods, setEmailPods] = useState<any[]>([]);
  const connectorRef = useRef<HTMLDivElement>(null);

  const requestProof = async () => {
    if (!connectorRef.current) return;
    setLoading(true);
    
    try {
      const clientUrl = "https://zupass.org";
      const z = await connect(myZapp, connectorRef.current, clientUrl);
      
      // Query email PODs
      const emailQuery = p.pod({
        entries: {
          emailAddress: { type: "string" },
          semaphoreV4PublicKey: { type: "eddsa_pubkey" },
          pod_type: { type: "string" }
        }
      });

      const queryResult = await z.pod.collection("Email").query(emailQuery);
      console.log("Email PODs:", queryResult);
      setEmailPods(queryResult);

      // Request proof
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
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  console.log('emailPods', emailPods, 'proofResult', proofResult);

  return (
    <OuterContainer>
      <PageContainer>
        <div
          className="flex-col"
          style={{ justifyContent: "center" }}
        >
          <img className="logo-image" src="logoicon.png" alt="agora logo" />
          <div ref={connectorRef} />
          <Button 
            onClick={requestProof} 
            disabled={loading}
          >
            {loading ? "Proving..." : "Request Proof"}
          </Button>
        </div>
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