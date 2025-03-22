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
    return res.status(400).json({ error: 'Invalid contract ID' });
  }

  // Find the contract and check if it belongs to the user
  const contract = await prisma.smartContract.findUnique({
    where: { id },
    include: {
      project: true
    }
  });

  if (!contract) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  // Check if the project belongs to the user
  const project = await prisma.project.findFirst({
    where: {
      id: contract.projectId,
      userId: user.id
    }
  });

  if (!project) {
    return res.status(403).json({ error: 'Unauthorized access to this contract' });
  }

  // Handle different HTTP methods
  switch (req.method) {
    case 'GET':
      return res.status(200).json(contract);

    case 'PUT':
      try {
        const { name } = req.body;
        
        const updatedContract = await prisma.smartContract.update({
          where: { id },
          data: { name }
        });
        
        return res.status(200).json(updatedContract);
      } catch (error) {
        console.error('Error updating contract:', error);
        return res.status(500).json({ error: 'Failed to update contract' });
      }

    case 'DELETE':
      try {
        await prisma.smartContract.delete({
          where: { id }
        });
        
        return res.status(204).end();
      } catch (error) {
        console.error('Error deleting contract:', error);
        return res.status(500).json({ error: 'Failed to delete contract' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}