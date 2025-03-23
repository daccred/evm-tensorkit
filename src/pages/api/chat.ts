import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import prisma from '@/lib/prisma';

// Create an OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Extract the request body
    const { messages, contractAddress, network, walletAddress, user } = req.body;

    // Validate required parameters
    if (!contractAddress) {
      return res.status(400).json({ error: 'Contract address is required' });
    }

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Find the contract by address
    const contract = await prisma.smartContract.findFirst({
      where: { 
        address: { equals: contractAddress, mode: 'insensitive' },
        network: network || 'mainnet',
      },
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Get the MCP schema
    const mcpSchema = contract.mcpSchema ? JSON.parse(contract.mcpSchema) : [];

    // Create a system message with contract information and available functions
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant that helps users interact with the Ethereum smart contract at address ${contractAddress} on the ${network || 'mainnet'} network.
      
The user's wallet address is ${walletAddress || user?.wallet?.address}. ${user ? `The user's object is ${user}.` : ''}

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
      stream: false,
    });

    // Return the response
    return res.status(200).json({
      role: 'assistant',
      content: response.choices[0].message.content,
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return res.status(500).json({ 
      error: error.message || 'An error occurred',
    });
  }
}