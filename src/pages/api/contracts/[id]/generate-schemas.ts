import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { abiToMCPSchema, abiToGPTActionSchema } from '@/lib/abi-to-mcp';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get the user from the request
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Authentication error:', authError);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Contract ID is required' });
    }

    // Get the contract
    const contract = await prisma.smartContract.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check if the contract belongs to the user
    if (contract.project.userId !== user.id) {
      return res.status(403).json({ error: 'You do not have permission to access this contract' });
    }

    // Generate MCP schema
    const mcpSchema = abiToMCPSchema(contract.abiJson);
    
    // Generate GPT Action schema
    const gptActionSchema = abiToGPTActionSchema(contract.abiJson);

    // Update the contract with the generated schemas
    const updatedContract = await prisma.smartContract.update({
      where: { id },
      data: {
        mcpSchema,
        gptActionSchema,
      },
    });

    return res.status(200).json({
      id: updatedContract.id,
      mcpSchema: updatedContract.mcpSchema,
      gptActionSchema: updatedContract.gptActionSchema,
    });
  } catch (error) {
    console.error('Error generating schemas:', error);
    return res.status(500).json({ error: 'Failed to generate schemas' });
  }
}