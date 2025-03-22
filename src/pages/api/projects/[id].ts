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
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  // Check if the project belongs to the user
  const project = await prisma.project.findFirst({
    where: {
      id,
      userId: user.id
    }
  });

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Handle different HTTP methods
  switch (req.method) {
    case 'GET':
      try {
        const projectWithContracts = await prisma.project.findUnique({
          where: { id },
          include: {
            contracts: true
          }
        });
        return res.status(200).json(projectWithContracts);
      } catch (error) {
        console.error('Error fetching project:', error);
        return res.status(500).json({ error: 'Failed to fetch project' });
      }

    case 'PUT':
      try {
        const { name, description } = req.body;
        
        if (!name) {
          return res.status(400).json({ error: 'Project name is required' });
        }

        const updatedProject = await prisma.project.update({
          where: { id },
          data: {
            name,
            description
          }
        });
        
        return res.status(200).json(updatedProject);
      } catch (error) {
        console.error('Error updating project:', error);
        return res.status(500).json({ error: 'Failed to update project' });
      }

    case 'DELETE':
      try {
        await prisma.project.delete({
          where: { id }
        });
        
        return res.status(204).end();
      } catch (error) {
        console.error('Error deleting project:', error);
        return res.status(500).json({ error: 'Failed to delete project' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}