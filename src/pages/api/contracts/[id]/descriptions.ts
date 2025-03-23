import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get the user from the request
  const supabase = createClient(req, res);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Authentication error:', authError);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  // GET: Retrieve custom function descriptions
  if (req.method === 'GET') {
    try {
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

      return res.status(200).json({
        customFunctionDescriptions: contract.customFunctionDescriptions || {},
      });
    } catch (error) {
      console.error('Error retrieving function descriptions:', error);
      return res.status(500).json({ error: 'Failed to retrieve function descriptions' });
    }
  }
  
  // PUT: Update custom function descriptions
  if (req.method === 'PUT') {
    try {
      const { customFunctionDescriptions } = req.body;

      if (!customFunctionDescriptions) {
        return res.status(400).json({ error: 'Custom function descriptions are required' });
      }

      const contract = await prisma.smartContract.findUnique({
        where: { id },
        include: { project: true },
      });

      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      // Check if the contract belongs to the user
      if (contract.project.userId !== user.id) {
        return res.status(403).json({ error: 'You do not have permission to modify this contract' });
      }

      // Update the contract with the custom function descriptions
      const updatedContract = await prisma.smartContract.update({
        where: { id },
        data: {
          customFunctionDescriptions: customFunctionDescriptions,
        },
      });

      // Regenerate MCP and GPT Action schemas with custom descriptions
      // This would be implemented in a separate function or endpoint

      return res.status(200).json({
        id: updatedContract.id,
        customFunctionDescriptions: updatedContract.customFunctionDescriptions,
      });
    } catch (error) {
      console.error('Error updating function descriptions:', error);
      return res.status(500).json({ error: 'Failed to update function descriptions' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}