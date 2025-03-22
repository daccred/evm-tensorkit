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

  // Handle different HTTP methods
  switch (req.method) {
    case 'GET':
      try {
        const projects = await prisma.project.findMany({
          where: { userId: user.id },
          include: {
            contracts: {
              select: {
                id: true,
                name: true,
                address: true,
                network: true,
                importMethod: true,
                createdAt: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json(projects);
      } catch (error) {
        console.error('Error fetching projects:', error);
        return res.status(500).json({ error: 'Failed to fetch projects' });
      }

    case 'POST':
      try {
        const { name, description } = req.body;
        
        if (!name) {
          return res.status(400).json({ error: 'Project name is required' });
        }

        const project = await prisma.project.create({
          data: {
            name,
            description,
            userId: user.id,
          }
        });
        
        return res.status(201).json(project);
      } catch (error) {
        console.error('Error creating project:', error);
        return res.status(500).json({ error: 'Failed to create project' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}