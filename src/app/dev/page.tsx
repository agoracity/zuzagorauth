"use client"

import { Zapp, connect } from "@parcnet-js/app-connector";
import * as p from "@parcnet-js/podspec";
import { useRef, useState } from "react";

const myZapp: Zapp = {
  name: "Email Proof Zapp",
  permissions: {
    REQUEST_PROOF: { collections: ["Email"] },
    READ_POD: { collections: ["Email"] },
    READ_PUBLIC_IDENTIFIERS: {}
  }
}

function Page() {
  const [proofResult, setProofResult] = useState<any>(null);
  const [emailPods, setEmailPods] = useState<any[]>([]);
  const connectorRef = useRef<HTMLDivElement>(null);

  const requestProof = async () => {
    if (!connectorRef.current) return;
    
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
  };

  console.log('emailPods', emailPods, 'proofResult', proofResult)
  return (
    <div>
      <div ref={connectorRef} />
      <button onClick={requestProof}>Request Proof</button>
    </div>
  );
}

export default Page;