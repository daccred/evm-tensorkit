import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/components/ui/use-toast';
import axios from 'axios';

interface ABIInput {
  name: string;
  type: string;
  internalType?: string;
  components?: ABIInput[];
}

interface ABIOutput {
  name: string;
  type: string;
  internalType?: string;
  components?: ABIOutput[];
}

interface ABIFunction {
  name: string;
  type: string;
  inputs: ABIInput[];
  outputs: ABIOutput[];
  stateMutability: string;
  constant?: boolean;
  payable?: boolean;
}

interface CustomFunctionDescription {
  description: string;
  inputs: {
    [paramName: string]: {
      description: string;
    };
  };
}

interface CustomFunctionDescriptions {
  [functionName: string]: CustomFunctionDescription;
}

interface ContractFunctionEditorProps {
  contractId: string;
  abiJson: string;
  customDescriptions?: CustomFunctionDescriptions;
  onUpdate: (updatedDescriptions: CustomFunctionDescriptions) => void;
}

export default function ContractFunctionEditor({
  contractId,
  abiJson,
  customDescriptions = {},
  onUpdate,
}: ContractFunctionEditorProps) {
  const { toast } = useToast();
  const [functions, setFunctions] = useState<ABIFunction[]>([]);
  const [editedDescriptions, setEditedDescriptions] = useState<CustomFunctionDescriptions>(customDescriptions);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const parsedAbi = JSON.parse(abiJson);
      // Filter for functions only
      const abiFunctions = parsedAbi.filter((item: any) => item.type === 'function');
      setFunctions(abiFunctions);

      // Initialize edited descriptions with existing custom descriptions
      const initialDescriptions: CustomFunctionDescriptions = {};
      abiFunctions.forEach((func: ABIFunction) => {
        initialDescriptions[func.name] = customDescriptions[func.name] || {
          description: generateDefaultFunctionDescription(func),
          inputs: func.inputs.reduce((acc, input) => {
            acc[input.name] = {
              description: customDescriptions[func.name]?.inputs?.[input.name]?.description || 
                generateDefaultParamDescription(input.name, input.type),
            };
            return acc;
          }, {} as { [paramName: string]: { description: string } }),
        };
      });
      setEditedDescriptions(initialDescriptions);
    } catch (error) {
      console.error('Error parsing ABI:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to parse ABI JSON',
      });
    }
  }, [abiJson, customDescriptions]);

  const generateDefaultFunctionDescription = (func: ABIFunction): string => {
    const paramList = func.inputs.map(input => `${input.name} (${input.type})`).join(', ');
    const returnList = func.outputs.map(output => `${output.name || 'return'} (${output.type})`).join(', ');
    
    let description = `Calls the ${func.name} function`;
    if (func.inputs.length > 0) {
      description += ` with parameters: ${paramList}`;
    }
    if (func.outputs.length > 0) {
      description += `. Returns: ${returnList}`;
    }
    
    // Add information about state mutability
    if (func.stateMutability === 'view' || func.stateMutability === 'pure') {
      description += '. This function does not modify blockchain state.';
    } else if (func.stateMutability === 'payable') {
      description += '. This function can receive Ether.';
    } else {
      description += '. This function may modify blockchain state.';
    }
    
    return description;
  };

  const generateDefaultParamDescription = (name: string, type: string): string => {
    if (type.includes('address')) {
      return `Ethereum address for ${name}`;
    }
    if (type.includes('uint256')) {
      return `Numeric value for ${name}`;
    }
    if (type.includes('bool')) {
      return `Boolean flag for ${name}`;
    }
    if (type.includes('string')) {
      return `String value for ${name}`;
    }
    if (type.includes('bytes')) {
      return `Bytes data for ${name}`;
    }
    return `Parameter ${name} of type ${type}`;
  };

  const handleFunctionDescriptionChange = (functionName: string, description: string) => {
    setEditedDescriptions(prev => ({
      ...prev,
      [functionName]: {
        ...prev[functionName],
        description,
      },
    }));
  };

  const handleParameterDescriptionChange = (functionName: string, paramName: string, description: string) => {
    setEditedDescriptions(prev => ({
      ...prev,
      [functionName]: {
        ...prev[functionName],
        inputs: {
          ...prev[functionName].inputs,
          [paramName]: {
            description,
          },
        },
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`/api/contracts/${contractId}/descriptions`, {
        customFunctionDescriptions: editedDescriptions,
      });
      
      onUpdate(editedDescriptions);
      
      toast({
        title: 'Success',
        description: 'Function descriptions updated successfully',
      });
    } catch (error) {
      console.error('Error saving descriptions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save function descriptions',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (functionName: string) => {
    const func = functions.find(f => f.name === functionName);
    if (!func) return;

    setEditedDescriptions(prev => ({
      ...prev,
      [functionName]: {
        description: generateDefaultFunctionDescription(func),
        inputs: func.inputs.reduce((acc, input) => {
          acc[input.name] = {
            description: generateDefaultParamDescription(input.name, input.type),
          };
          return acc;
        }, {} as { [paramName: string]: { description: string } }),
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Contract Function Descriptions</h2>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>
      
      <p className="text-muted-foreground">
        Customize how the AI understands and interacts with your smart contract functions. 
        These descriptions will be used to generate more accurate and user-friendly interactions.
      </p>
      
      <Accordion type="multiple" className="w-full">
        {functions.map((func) => (
          <AccordionItem key={func.name} value={func.name}>
            <AccordionTrigger className="text-lg font-medium">
              <div className="flex items-center">
                <span>{func.name}</span>
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({func.stateMutability})
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Card className="border-none shadow-none">
                <CardContent className="p-0 pt-4 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor={`${func.name}-description`}>Function Description</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleReset(func.name)}
                        className="h-6 text-xs"
                      >
                        Reset to Default
                      </Button>
                    </div>
                    <Textarea
                      id={`${func.name}-description`}
                      value={editedDescriptions[func.name]?.description || ''}
                      onChange={(e) => handleFunctionDescriptionChange(func.name, e.target.value)}
                      className="min-h-[100px]"
                      placeholder="Describe what this function does in a way that's easy for AI to understand"
                    />
                  </div>
                  
                  {func.inputs.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-medium">Parameter Descriptions</h4>
                      {func.inputs.map((input) => (
                        <div key={`${func.name}-${input.name}`} className="space-y-2">
                          <Label htmlFor={`${func.name}-${input.name}-description`}>
                            {input.name} <span className="text-xs text-muted-foreground">({input.type})</span>
                          </Label>
                          <Input
                            id={`${func.name}-${input.name}-description`}
                            value={editedDescriptions[func.name]?.inputs?.[input.name]?.description || ''}
                            onChange={(e) => 
                              handleParameterDescriptionChange(func.name, input.name, e.target.value)
                            }
                            placeholder={`Description for ${input.name}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      
      {functions.length === 0 && (
        <div className="text-center p-10 border border-dashed rounded-lg">
          <p className="text-muted-foreground">No functions found in this contract's ABI.</p>
        </div>
      )}
      
      <div className="flex justify-end mt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>
    </div>
  );
}