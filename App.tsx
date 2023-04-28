// shims
import '@sinonjs/text-encoding'
import 'react-native-get-random-values'
import '@ethersproject/shims'
import 'cross-fetch/polyfill'
// filename: App.tsx

// ... shims
import { v4 } from 'uuid'

import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, View, Text, Button } from 'react-native'

// Import the agent from our earlier setup
import { agent } from './setup'
// import some data types:
import { DIDResolutionResult, IIdentifier } from '@veramo/core'

import { IVerifyResult } from '@veramo/core'

import { IDIDCommMessage } from '@veramo/did-comm'




const App = () => {
  const [identifiers, setIdentifiers] = useState<IIdentifier[]>([])
  const [resolutionResult, setResolutionResult] = useState<DIDResolutionResult | undefined>()

  // Resolve a DID
  const resolveDID = async (did: string) => {
    const result = await agent.resolveDid({ didUrl: did })
    console.log(JSON.stringify(result, null, 2))
    setResolutionResult(result)
  }

  const STATUS_REQUEST_MESSAGE_TYPE =
  'https://didcomm.org/messagepickup/3.0/status-request'

  const DELIVERY_REQUEST_MESSAGE_TYPE =
  'https://didcomm.org/messagepickup/3.0/delivery-request'

  function createStatusRequestMessage(
    recipientDidUrl: string,
    mediatorDidUrl: string,
    ): IDIDCommMessage {
    return {
      id: v4(),
      type: STATUS_REQUEST_MESSAGE_TYPE,
      to: mediatorDidUrl,
      from: recipientDidUrl,
      return_route: 'all',
      body: {},
    }
  }

  function deliveryRequestMessage(
    recipientDidUrl: string,
    mediatorDidUrl: string,
  ): IDIDCommMessage {
    return {
      id: v4(),
      type: DELIVERY_REQUEST_MESSAGE_TYPE,
      to: mediatorDidUrl,
      from: recipientDidUrl,
      return_route: 'all',
      body: { limit: 2 },
    }
  }

  // Add the new identifier to state
  const createIdentifier = async () => {
    const _id = await agent.didManagerCreate({
      alias: 'alice',
      provider: 'did:peer',
      options: {
        num_algo: 2,
        service: {
          id: '1234',
          type: 'DIDCommMessaging',
          serviceEndpoint: 'did:peer:dev-didcomm-mediator.herokuapp.com',
          description: 'a DIDComm endpoint',
        },
      },
    })
    setIdentifiers((s) => s.concat([_id]))
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      setIdentifiers(_ids)

      // Inspect the id object in your debug tool
      console.log('_ids:', _ids)
    }

    getIdentifiers()
  }, [])

  const [credential, setCredential] = useState<VerifiableCredential | undefined>()

  const [presentation, setPresentation] = useState<VerifiablePresentation | undefined>()


  const createCredential = async () => {
    if (identifiers[0].did) {
      const verifiableCredential = await agent.createVerifiableCredential({
        credential: {
          issuer: { id: identifiers[0].did },
          issuanceDate: new Date().toISOString(),
          credentialSubject: {
            id: 'did:web:community.veramo.io',
            you: 'Rock',
          },
        },
        save: false,
        proofFormat: 'jwt',
      })

      setCredential(verifiableCredential)
    }
  }

  const createPresentation = async () => {
    if (credential) {
      const verifiablePresentation = await agent.createVerifiablePresentation(
       { 
        presentation: {
          holder: identifiers[0].did,
          verifier: [identifiers[0].did],
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiablePresentation'],
          verifiableCredential: [credential],
        },
        //challenge: 'VERAMO',
        // TODO: QueryFailedError: SQLITE_CONSTRAINT: NOT NULL constraint failed: presentation.issuanceDate
        // Currently LD Presentations are NEVER saved. (they have no issuanceDate)
        //save: true,
        proofFormat: 'jwt',
      }
      
      )

    //console.log(VerifiablePresentation)

      setPresentation(verifiablePresentation)
    }
  }

  const [verificationResult, setVerificationResult] = useState<IVerifyResult | undefined>()

  const verifyCredential = async () => {
    if (credential) {
      const result = await agent.verifyCredential({ credential })
      setVerificationResult(result)
    }
  }

  const [verificationResultP, setVerificationResultP] = useState<IVerifyResult | undefined>()

  const verifyPresentation = async () => {
    if (presentation) {
      const result = await agent.verifyPresentation({ presentation })
      setVerificationResultP(result)
    }
  }

  const sendMessage =async () => {
    
    const message = {
      type: 'test',
      to: identifiers[identifiers.length-1].did,
      from: identifiers[identifiers.length-2],
      id: '1250',
      body: { hello: 'world het' },
    }
    const packedMessage = await agent.packDIDCommMessage({
      packing: 'none',
      message,
    })
    const result = await agent.sendDIDCommMessage({
      messageId: '1250',
      packedMessage,
      recipientDidUrl: identifiers[identifiers.length-1].did,
    })
    console.log(result)
  }

  const receivedMessage =async () => {
    

    const statusMessage = await createStatusRequestMessage({
      mediatorDidUrl:'did:web:dev-didcomm-mediator.herokuapp.com',
      recipientDidUrl: identifiers[identifiers.length-1].did,
    })
    
    const packedStatusMessage = await agent.packDIDCommMessage({
      packing: 'none',
      message: statusMessage,
    })

    const result1=await agent.sendDIDCommMessage({
      messageId: statusMessage.id,
      packedMessage: packedStatusMessage,
      recipientDidUrl: 'did:web:dev-didcomm-mediator.herokuapp.com',
    })

    const deliveryMessage = await deliveryRequestMessage({
      recipientDidUrl: identifiers[identifiers.length-1].did,
      mediatorDidUrl: 'did:web:dev-didcomm-mediator.herokuapp.com',
  })

  const packedDeliveryMessage = await agent.packDIDCommMessage({
    packing: 'none',
    message: deliveryMessage,
  })
  const result=await agent.sendDIDCommMessage({
    messageId: deliveryMessage.id,
    packedMessage: packedDeliveryMessage,
    recipientDidUrl: 'did:web:dev-didcomm-mediator.herokuapp.com',
  })

  console.log(result)
    //console.log(packedStatusMessage)
  }

  const getMessage =async () => {
    

    const messages = await agent.dataStoreGetMessage({
      where: [{ column: 'type', value: ['veramo.io-chat-v1'] }],
      order: [{ column: 'createdAt', direction: 'DESC' }],
    })
    


  console.log(message)
    //console.log(packedStatusMessage)
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Identifiers</Text>
          <Button onPress={() => createIdentifier()} title={'Create Identifier'} />
          <View style={{ marginBottom: 50, marginTop: 20 }}>
            {identifiers && identifiers.length > 0 ? (
              identifiers.map((id: IIdentifier) => (
                <Button onPress={() => resolveDID(id.did)} title={id.did} />
              ))
            ) : (
              <Text>No identifiers created yet</Text>
            )}
          </View>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Resolved DID document:</Text>
          <View style={{ marginBottom: 50, marginTop: 20 }}>
            {resolutionResult ? (
              <Text>{JSON.stringify(resolutionResult.didDocument, null, 2)}</Text>
            ) : (
              <Text>tap on a DID to resolve it</Text>
            )}
          </View>

        </View>

        {/* previously added code */}



        <View style={{ padding: 20 }}>
          <Button
            title={'Create Credential'}
            disabled={!identifiers || identifiers.length === 0}
            onPress={() => createCredential()}
          />
          <Text style={{ fontSize: 10 }}>{JSON.stringify(credential, null, 2)}</Text>
        </View>



        {/* previously added code */}
        <View style={{ padding: 20 }}>
          <Button title={'Verify Credential'} onPress={() => verifyCredential()} disabled={!credential} />
          <Text style={{ fontSize: 10 }}>{JSON.stringify(verificationResult, null, 2)}</Text>
        </View>


        <View style={{ padding: 20 }}>
          <Button
            title={'Create Presentation'}
            disabled={!credential}
            onPress={() => createPresentation()}
          />
          <Text style={{ fontSize: 10 }}>{JSON.stringify(presentation, null, 2)}</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Button title={'Verify Presentation'} onPress={() => verifyPresentation()} disabled={!presentation} />
          <Text style={{ fontSize: 10 }}>{JSON.stringify(verificationResultP, null, 2)}</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Button title={'Send Message'} onPress={() => sendMessage()}  />
        </View>

        <View style={{ padding: 20 }}>
          <Button title={'Recieved Message'} onPress={() => receivedMessage()}  />
        </View>

        <View style={{ padding: 20 }}>
          <Button title={'Get Message'} onPress={() => getMessage()}  />
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

export default App
