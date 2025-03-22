import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, PlusCircle, Trash2, Edit, ExternalLink } from 'lucide-react';
import axios from 'axios';

interface SmartContract {
  id: string;
  name: string | null;
  address: string;
  abiJson: string;
  network: string;
  sourceCode?: string | null;
  networkData?: any;
  importMethod: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  contracts: SmartContract[];
}

export default function ProjectDetail() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [importMethod, setImportMethod] = useState('etherscan');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  // Form states
  const [etherscanLink, setEtherscanLink] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [contractNetwork, setContractNetwork] = useState('ethereum');
  const [contractName, setContractName] = useState('');
  const [abiJson, setAbiJson] = useState('');

  const fetchProject = async () => {
    if (!id || typeof id !== 'string') return;
    
    try {
      setLoading(true);
      const response = await axios.get(`/api/projects/${id}`);
      setProject(response.data);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load project details',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && id) {
      fetchProject();
    }
  }, [user, id]);

  const handleImportContract = async () => {
    try {
      if (importMethod === 'etherscan') {
        if (!etherscanLink || !contractAddress || !contractNetwork) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Please fill in all required fields',
          });
          return;
        }

        const response = await axios.post('/api/contracts', {
          projectId: id,
          importMethod: 'etherscan',
          etherscanLink,
          address: contractAddress,
          network: contractNetwork,
        });

        setProject(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            contracts: [...prev.contracts, response.data],
          };
        });

        toast({
          title: 'Success',
          description: 'Contract imported successfully from Etherscan',
        });
      } else {
        if (!contractAddress || !abiJson || !contractNetwork) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Please fill in all required fields',
          });
          return;
        }

        // Validate ABI JSON
        try {
          JSON.parse(abiJson);
        } catch (e) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Invalid ABI JSON format',
          });
          return;
        }

        const response = await axios.post('/api/contracts', {
          projectId: id,
          importMethod: 'manual',
          name: contractName,
          address: contractAddress,
          abiJson,
          network: contractNetwork,
        });

        setProject(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            contracts: [...prev.contracts, response.data],
          };
        });

        toast({
          title: 'Success',
          description: 'Contract imported successfully',
        });
      }

      // Reset form
      setEtherscanLink('');
      setContractAddress('');
      setContractNetwork('ethereum');
      setContractName('');
      setAbiJson('');
      setImportDialogOpen(false);
    } catch (error: any) {
      console.error('Error importing contract:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to import contract',
      });
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('Are you sure you want to delete this contract? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`/api/contracts/${contractId}`);
      
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          contracts: prev.contracts.filter(c => c.id !== contractId),
        };
      });

      toast({
        title: 'Success',
        description: 'Contract deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting contract:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete contract',
      });
    }
  };

  const getNetworkExplorerUrl = (network: string, address: string) => {
    const networkMap: Record<string, string> = {
      'ethereum': 'https://etherscan.io/address/',
      'goerli': 'https://goerli.etherscan.io/address/',
      'sepolia': 'https://sepolia.etherscan.io/address/',
      'polygon': 'https://polygonscan.com/address/',
      'polygon-mumbai': 'https://mumbai.polygonscan.com/address/',
    };

    const baseUrl = networkMap[network] || 'https://etherscan.io/address/';
    return `${baseUrl}${address}`;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen bg-background">
          <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
            <div className="flex justify-center items-center h-64">
              <p>Loading project details...</p>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!project) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen bg-background">
          <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
            <div className="text-center p-10 border border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">Project not found or you don't have access to it.</p>
              <Button onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-background">
        <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-2">{project.description}</p>
              )}
            </div>
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Import Contract
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Import Smart Contract</DialogTitle>
                  <DialogDescription>
                    Import a smart contract by providing an Etherscan link or manually entering the details.
                  </DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue="etherscan" onValueChange={setImportMethod}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="etherscan">From Etherscan</TabsTrigger>
                    <TabsTrigger value="manual">Manual Input</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="etherscan" className="space-y-4 mt-4">
                    <div className="grid gap-2">
                      <Label htmlFor="etherscan-link">Etherscan Link</Label>
                      <Input
                        id="etherscan-link"
                        value={etherscanLink}
                        onChange={(e) => setEtherscanLink(e.target.value)}
                        placeholder="https://etherscan.io/address/0x..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contract-address">Contract Address</Label>
                      <Input
                        id="contract-address"
                        value={contractAddress}
                        onChange={(e) => setContractAddress(e.target.value)}
                        placeholder="0x..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contract-network">Network</Label>
                      <select
                        id="contract-network"
                        value={contractNetwork}
                        onChange={(e) => setContractNetwork(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="ethereum">Ethereum Mainnet</option>
                        <option value="goerli">Goerli Testnet</option>
                        <option value="sepolia">Sepolia Testnet</option>
                        <option value="polygon">Polygon Mainnet</option>
                        <option value="polygon-mumbai">Polygon Mumbai Testnet</option>
                      </select>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="manual" className="space-y-4 mt-4">
                    <div className="grid gap-2">
                      <Label htmlFor="contract-name">Contract Name (Optional)</Label>
                      <Input
                        id="contract-name"
                        value={contractName}
                        onChange={(e) => setContractName(e.target.value)}
                        placeholder="My Token Contract"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="manual-address">Contract Address</Label>
                      <Input
                        id="manual-address"
                        value={contractAddress}
                        onChange={(e) => setContractAddress(e.target.value)}
                        placeholder="0x..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="manual-network">Network</Label>
                      <select
                        id="manual-network"
                        value={contractNetwork}
                        onChange={(e) => setContractNetwork(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="ethereum">Ethereum Mainnet</option>
                        <option value="goerli">Goerli Testnet</option>
                        <option value="sepolia">Sepolia Testnet</option>
                        <option value="polygon">Polygon Mainnet</option>
                        <option value="polygon-mumbai">Polygon Mumbai Testnet</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="abi-json">ABI JSON</Label>
                      <Textarea
                        id="abi-json"
                        value={abiJson}
                        onChange={(e) => setAbiJson(e.target.value)}
                        placeholder='[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"}...]'
                        className="min-h-[150px] font-mono text-xs"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleImportContract}>Import Contract</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Smart Contracts</h2>
            
            {project.contracts.length === 0 ? (
              <div className="text-center p-10 border border-dashed rounded-lg">
                <p className="text-muted-foreground mb-4">No contracts imported yet.</p>
                <Button onClick={() => setImportDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Import Your First Contract
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {project.contracts.map((contract) => (
                  <Card key={contract.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{contract.name || 'Unnamed Contract'}</CardTitle>
                          <CardDescription className="font-mono text-xs mt-1">
                            {contract.address}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeleteContract(contract.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">Network</p>
                          <p className="text-sm text-muted-foreground">{contract.network}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Import Method</p>
                          <p className="text-sm text-muted-foreground capitalize">{contract.importMethod}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Imported On</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(contract.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getNetworkExplorerUrl(contract.network, contract.address), '_blank')}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View on Explorer
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}