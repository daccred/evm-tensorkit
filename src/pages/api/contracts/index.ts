import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import axios from 'axios';

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
    const { projectId, importMethod, address, abiJson, network, etherscanLink } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if the project belongs to the user
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Handle different import methods
    if (importMethod === 'etherscan') {
      if (!etherscanLink || !address || !network) {
        return res.status(400).json({ error: 'Etherscan link, address, and network are required for Etherscan import' });
      }

      try {
        // Extract contract address from Etherscan link if not provided directly
        let contractAddress = address;
        
        // Fetch contract data from Etherscan API
        const apiKey = process.env.ETHERSCAN_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: 'Etherscan API key not configured' });
        }

        // Determine the correct Etherscan API URL based on the network
        let apiUrl = 'https://api.etherscan.io/api';
        if (network.includes('goerli')) {
          apiUrl = 'https://api-goerli.etherscan.io/api';
        } else if (network.includes('sepolia')) {
          apiUrl = 'https://api-sepolia.etherscan.io/api';
        } else if (network.includes('polygon')) {
          apiUrl = 'https://api.polygonscan.com/api';
        }

        // Fetch ABI
        const abiResponse = await axios.get(apiUrl, {
          params: {
            module: 'contract',
            action: 'getabi',
            address: contractAddress,
            apikey: apiKey
          }
        });

        if (abiResponse.data.status !== '1') {
          console.error('Etherscan API error:', abiResponse.data);
          return res.status(400).json({ error: `Failed to fetch ABI: ${abiResponse.data.message || 'Unknown error'}` });
        }

        const fetchedAbiJson = abiResponse.data.result;

        // Fetch source code
        const sourceResponse = await axios.get(apiUrl, {
          params: {
            module: 'contract',
            action: 'getsourcecode',
            address: contractAddress,
            apikey: apiKey
          }
        });

        if (sourceResponse.data.status !== '1') {
          console.error('Etherscan API error:', sourceResponse.data);
          return res.status(400).json({ error: `Failed to fetch source code: ${sourceResponse.data.message || 'Unknown error'}` });
        }

        const sourceCode = sourceResponse.data.result[0].SourceCode;
        const contractName = sourceResponse.data.result[0].ContractName;

        // Create the smart contract
        const contract = await prisma.smartContract.create({
          data: {
            name: contractName || 'Unnamed Contract',
            address: contractAddress,
            abiJson: fetchedAbiJson,
            network,
            sourceCode,
            networkData: sourceResponse.data.result[0],
            importMethod: 'etherscan',
            projectId
          }
        });
        
        return res.status(201).json(contract);
      } catch (error) {
        console.error('Error fetching from Etherscan:', error);
        return res.status(500).json({ error: 'Failed to fetch contract data from Etherscan' });
      }
    } else if (importMethod === 'manual') {
      // Manual import
      if (!address || !abiJson || !network) {
        return res.status(400).json({ error: 'Address, ABI JSON, and network are required for manual import' });
      }

      // Validate ABI JSON
      try {
        JSON.parse(abiJson);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid ABI JSON format' });
      }

      // Create the smart contract
      const contract = await prisma.smartContract.create({
        data: {
          name: req.body.name || 'Unnamed Contract',
          address,
          abiJson,
          network,
          importMethod: 'manual',
          projectId
        }
      });
      
      return res.status(201).json(contract);
    } else {
      return res.status(400).json({ error: 'Invalid import method' });
    }
  } catch (error) {
    console.error('Error creating smart contract:', error);
    return res.status(500).json({ error: 'Failed to create smart contract' });
  }
}