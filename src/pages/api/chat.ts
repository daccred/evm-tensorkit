import { NextRequest } from 'next/server';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';
import prisma from '@/lib/prisma';

// Create an OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  try {
    // Extract the request body
    const { messages, contractAddress, network, walletAddress } = await req.json();

    // Validate required parameters
    if (!contractAddress) {
      return new Response(JSON.stringify({ error: 'Contract address is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!walletAddress) {
      return new Response(JSON.stringify({ error: 'Wallet address is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find the contract by address
    const contract = await prisma.smartContract.findFirst({
      where: { 
        address: { equals: contractAddress, mode: 'insensitive' },
        network: network || 'mainnet',
      },
    });

    if (!contract) {
      return new Response(JSON.stringify({ error: 'Contract not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the MCP schema
    const mcpSchema = contract.mcpSchema ? JSON.parse(contract.mcpSchema) : [];

    // Create a system message with contract information and available functions
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant that helps users interact with the Ethereum smart contract at address ${contractAddress} on the ${network || 'mainnet'} network.
      
The user's wallet address is ${walletAddress}.

The contract has the following functions available:
${mcpSchema.map((func: any) => `- ${func.name}: ${func.description}`).join('\n')}

When the user wants to execute a function, format your response as a JSON object with the following structure:
{
  "action": "function_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}

For read-only functions, you can execute them directly. For state-changing functions, explain that they require a transaction and gas fees.

Be helpful, concise, and accurate in your responses.`,
    };

    // Combine the system message with the user messages
    const combinedMessages = [systemMessage, ...messages];

    // Call the OpenAI API with the combined messages
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: combinedMessages,
      stream: true,
    });

    // Convert the response to a streaming text response
    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);
  } catch (error: any) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}