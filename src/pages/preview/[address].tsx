import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import prisma from '@/lib/prisma';
import { RainbowKitProvider } from '@/components/RainbowKitProvider';
import { MCPClient } from '@/components/MCPClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import '@rainbow-me/rainbowkit/styles.css';

interface PreviewPageProps {
  contract: {
    id: string;
    name: string | null;
    address: string;
    network: string;
    mcpSchema: string | null;
  } | null;
  error?: string;
}

export default function PreviewPage({ contract, error }: PreviewPageProps) {
  const router = useRouter();
  
  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!contract) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Fetching contract information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <RainbowKitProvider>
      <div className="container mx-auto py-8">
        <Card className="max-w-3xl mx-auto mb-8">
          <CardHeader>
            <CardTitle>{contract.name || 'Smart Contract'}</CardTitle>
            <CardDescription>
              Address: {contract.address} | Network: {contract.network}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              This is a preview environment for interacting with this smart contract.
              Connect your wallet to use the voice-assisted MCP client.
            </p>
            <Separator className="my-4" />
            <MCPClient 
              contractAddress={contract.address} 
              network={contract.network} 
            />
          </CardContent>
        </Card>
      </div>
    </RainbowKitProvider>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { address } = context.params || {};
  
  if (!address || typeof address !== 'string') {
    return {
      props: {
        contract: null,
        error: 'Contract address is required',
      },
    };
  }
  
  try {
    // Find the contract by address
    const contract = await prisma.smartContract.findFirst({
      where: { 
        address: { equals: address, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        address: true,
        network: true,
        mcpSchema: true,
      },
    });
    
    if (!contract) {
      return {
        props: {
          contract: null,
          error: `Contract not found with address: ${address}`,
        },
      };
    }
    
    if (!contract.mcpSchema) {
      return {
        props: {
          contract: null,
          error: 'This contract does not have an MCP schema',
        },
      };
    }
    
    return {
      props: {
        contract: {
          ...contract,
          mcpSchema: null, // Don't send the full schema to the client
        },
      },
    };
  } catch (error) {
    console.error('Error fetching contract:', error);
    return {
      props: {
        contract: null,
        error: 'Failed to fetch contract information',
      },
    };
  }
};