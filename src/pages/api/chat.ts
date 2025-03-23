import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import prisma from '@/lib/prisma';

// Create an OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[chat] Received request');
  
  try {
    // Extract the request body
    const { messages, contractAddress, network, walletAddress, user } = req.body;

    // Validate required parameters
    if (!contractAddress) {
      console.log('[chat] Error: Contract address is required');
      return res.status(400).json({ error: 'Contract address is required' });
    }

    if (!walletAddress) {
      console.log('[chat] Error: Wallet address is required');
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Find the contract by address
    console.log(`[chat] Finding contract: ${contractAddress} on ${network || 'mainnet'}`);
    const contract = await prisma.smartContract.findFirst({
      where: { 
        address: { equals: contractAddress, mode: 'insensitive' },
        network: network || 'mainnet',
      },
    });

    if (!contract) {
      console.log('[chat] Error: Contract not found');
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Get the MCP schema
    const mcpSchema = contract.mcpSchema ? JSON.parse(contract.mcpSchema) : [];
    console.log(`[chat] Found contract with ${mcpSchema.length} functions`);

    // Create functions for OpenAI based on the MCP schema
    const functions = mcpSchema.map((func: any) => {
      // Create parameters object for the function
      const parameters: any = {
        type: 'object',
        properties: {},
        required: [],
      };

      // Add each parameter to the properties
      if (func.inputs && Array.isArray(func.inputs)) {
        func.inputs.forEach((input: any) => {
          // Map Solidity types to JSON Schema types
          let type = 'string'; // Default to string for most Ethereum types
          if (input.type.includes('int')) {
            type = 'number';
          } else if (input.type === 'bool') {
            type = 'boolean';
          }

          parameters.properties[input.name] = {
            type,
            description: input.description || `${input.name} parameter`,
          };

          // Add to required list if not optional
          if (!input.optional) {
            parameters.required.push(input.name);
          }
        });
      }

      return {
        name: func.name,
        description: func.description || `Execute the ${func.name} function`,
        parameters,
      };
    });

    // Create a system message with contract information
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant that helps users interact with the Ethereum smart contract at address ${contractAddress} on the ${network || 'mainnet'} network.
      
The user's wallet address is ${walletAddress || user?.wallet?.address}. ${user ? `The user's object is ${user}.` : ''}

You have access to the contract's functions through the function calling API. When a user wants to execute a function, use the appropriate function call.

For read-only functions, you can execute them directly. For state-changing functions, explain that they require a transaction and gas fees.

Be helpful, concise, and accurate in your responses.`,
    };

    // Combine the system message with the user messages
    const combinedMessages = [systemMessage, ...messages];

    console.log('[chat] Calling OpenAI API with function definitions');
    
    // Call the OpenAI API with the combined messages and functions
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: combinedMessages,
      tools: functions.length > 0 ? [
        {
          type: 'function',
          function: {
            name: 'execute_contract_function',
            description: 'Execute a function on the smart contract',
            parameters: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  description: 'The name of the function to execute',
                  enum: mcpSchema.map((func: any) => func.name),
                },
                parameters: {
                  type: 'object',
                  description: 'The parameters for the function call',
                },
              },
              required: ['action', 'parameters'],
            },
          },
        },
      ] : undefined,
      tool_choice: 'auto',
    });

    const assistantMessage = response.choices[0].message;
    console.log('[chat] Received response from OpenAI');

    // Check if there's a function call in the response
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      
      if (toolCall.function.name === 'execute_contract_function') {
        try {
          const functionArgs = JSON.parse(toolCall.function.arguments);
          console.log(`[chat] Function call detected: ${functionArgs.action}`);
          
          // Return both the message content and the function call
          return res.status(200).json({
            role: 'assistant',
            content: assistantMessage.content || "I'll execute this function for you.",
            functionCall: {
              action: functionArgs.action,
              parameters: functionArgs.parameters,
            },
          });
        } catch (error) {
          console.error('[chat] Error parsing function arguments:', error);
        }
      }
    }

    // If no function call or error parsing, just return the message content
    return res.status(200).json({
      role: 'assistant',
      content: assistantMessage.content,
    });
  } catch (error: any) {
    console.error('[chat] API error:', error);
    return res.status(500).json({ 
      error: error.message || 'An error occurred',
    });
  }
}