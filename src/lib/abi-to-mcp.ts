/**
 * Utility functions to convert Ethereum ABI to Model Context Protocol (MCP) schema
 * Based on the MCP specification: https://modelcontextprotocol.io/llms-full.txt
 * and OpenAI GPT Actions: https://platform.openai.com/docs/actions/getting-started
 */

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

interface MCPParameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
  properties?: Record<string, MCPParameter>;
  items?: {
    type: string;
    properties?: Record<string, MCPParameter>;
  };
}

interface MCPAction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, MCPParameter>;
    required: string[];
  };
}

interface GPTAction {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  };
}

/**
 * Maps Solidity types to JSON Schema types
 */
const solTypeToJsonType = (solType: string): string => {
  if (solType.includes('int')) return 'integer';
  if (solType.includes('bool')) return 'boolean';
  if (solType.includes('address')) return 'string';
  if (solType.includes('string')) return 'string';
  if (solType.includes('bytes')) return 'string';
  if (solType.includes('[]')) return 'array';
  return 'string'; // Default fallback
};

/**
 * Generates a description for a parameter based on its Solidity type
 */
const generateParamDescription = (name: string, type: string): string => {
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

/**
 * Generates a description for a function based on its name and parameters
 */
const generateFunctionDescription = (func: ABIFunction): string => {
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

/**
 * Processes an ABI input/output parameter and converts it to MCP schema format
 */
const processABIParameter = (param: ABIInput | ABIOutput): MCPParameter => {
  const name = param.name || 'param';
  const jsonType = solTypeToJsonType(param.type);
  
  const mcpParam: MCPParameter = {
    name,
    type: jsonType,
    description: generateParamDescription(name, param.type),
  };
  
  // Handle arrays
  if (param.type.includes('[]')) {
    mcpParam.type = 'array';
    mcpParam.items = {
      type: solTypeToJsonType(param.type.replace('[]', '')),
    };
  }
  
  // Handle complex structs
  if (param.components && param.components.length > 0) {
    if (param.type.includes('[]')) {
      mcpParam.items = {
        type: 'object',
        properties: {},
      };
      
      param.components.forEach(component => {
        const processedComponent = processABIParameter(component);
        if (mcpParam.items && mcpParam.items.properties) {
          mcpParam.items.properties[component.name] = processedComponent;
        }
      });
    } else {
      mcpParam.type = 'object';
      mcpParam.properties = {};
      
      param.components.forEach(component => {
        const processedComponent = processABIParameter(component);
        if (mcpParam.properties) {
          mcpParam.properties[component.name] = processedComponent;
        }
      });
    }
  }
  
  return mcpParam;
};

/**
 * Converts an ABI function to MCP action format
 */
const abiFunctionToMCPAction = (func: ABIFunction): MCPAction => {
  const action: MCPAction = {
    name: func.name,
    description: generateFunctionDescription(func),
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  };
  
  // Process inputs
  func.inputs.forEach(input => {
    const processedInput = processABIParameter(input);
    action.parameters.properties[input.name] = processedInput;
    action.parameters.required.push(input.name);
  });
  
  return action;
};

/**
 * Converts an MCP action to OpenAI GPT Action format
 */
const mcpActionToGPTAction = (mcpAction: MCPAction): GPTAction => {
  return {
    type: 'function',
    function: {
      name: mcpAction.name,
      description: mcpAction.description,
      parameters: mcpAction.parameters,
    },
  };
};

/**
 * Converts an ABI JSON string to MCP schema
 */
export const abiToMCPSchema = (abiJson: string): string => {
  try {
    const abi = JSON.parse(abiJson);
    
    // Filter for functions only
    const functions = abi.filter((item: any) => 
      item.type === 'function' && 
      // Exclude view/pure functions with no inputs as they're typically getters
      !(item.stateMutability === 'view' && item.inputs.length === 0)
    );
    
    // Convert each function to MCP action
    const mcpActions = functions.map((func: ABIFunction) => abiFunctionToMCPAction(func));
    
    return JSON.stringify(mcpActions, null, 2);
  } catch (error) {
    console.error('Error converting ABI to MCP schema:', error);
    throw new Error('Failed to convert ABI to MCP schema');
  }
};

/**
 * Converts an ABI JSON string to OpenAI GPT Action schema
 */
export const abiToGPTActionSchema = (abiJson: string): string => {
  try {
    const mcpSchema = JSON.parse(abiToMCPSchema(abiJson));
    const gptActions = mcpSchema.map((action: MCPAction) => mcpActionToGPTAction(action));
    
    return JSON.stringify(gptActions, null, 2);
  } catch (error) {
    console.error('Error converting ABI to GPT Action schema:', error);
    throw new Error('Failed to convert ABI to GPT Action schema');
  }
};