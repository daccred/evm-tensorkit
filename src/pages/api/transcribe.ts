import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Configure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Disable the default body parser to handle form data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[transcribe] Received request');
  
  if (req.method !== 'POST') {
    console.log('[transcribe] Error: Method not allowed');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the incoming form data
    console.log('[transcribe] Parsing form data');
    const { fields, files } = await parseForm(req);
    
    if (!files.file) {
      console.log('[transcribe] Error: No audio file provided');
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    const file = files.file as any;
    console.log(`[transcribe] File received: ${file.originalFilename}, size: ${file.size} bytes`);
    
    // Check if the file is empty or too small
    if (file.size < 100) {
      console.log('[transcribe] Error: Audio file is too small or empty');
      return res.status(400).json({ error: 'Audio file is too small or empty' });
    }
    
    try {
      // Transcribe the audio using OpenAI's latest Whisper model
      console.log('[transcribe] Sending to OpenAI Whisper API');
      const transcription = await openai.audio.transcriptions.create({
        file: createReadStream(file.filepath),
        model: 'whisper-1', // Using whisper-1 which is the latest available model
        response_format: 'json',
        temperature: 0.0, // Lowest temperature for most accurate transcriptions
        language: 'en', // Specify English for better accuracy
        prompt: "This is a conversation about Ethereum smart contracts and blockchain technology.", // Context hint
      });
      
      console.log('[transcribe] Transcription successful');
      console.log(`[transcribe] Transcribed text: "${transcription.text}"`);
      
      // Clean up the temporary file
      await fs.unlink(file.filepath);
      
      return res.status(200).json({ text: transcription.text });
    } catch (openaiError: any) {
      console.error('[transcribe] OpenAI API Error:', openaiError);
      
      // Clean up the temporary file even if transcription fails
      try {
        await fs.unlink(file.filepath);
      } catch (unlinkError) {
        console.error('[transcribe] Error deleting temporary file:', unlinkError);
      }
      
      // Check for specific OpenAI errors
      if (openaiError.status === 429) {
        return res.status(429).json({ 
          error: 'OpenAI API rate limit exceeded. Please try again later.',
          details: openaiError.message
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to transcribe audio with OpenAI',
        details: openaiError.message || String(openaiError)
      });
    }
  } catch (error: any) {
    console.error('[transcribe] General Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process audio',
      details: error?.message || String(error)
    });
  }
}

// Helper function to parse form data
function parseForm(req: NextApiRequest): Promise<{ fields: any; files: any }> {
  return new Promise((resolve, reject) => {
    const uploadDir = path.join(os.tmpdir(), 'uploads');
    
    // Ensure the upload directory exists
    try {
      fs.mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error('[transcribe] Error creating upload directory:', error);
    }
    
    const form = new IncomingForm({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB max file size
    });
    
    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('[transcribe] Form parsing error:', err);
        return reject(err);
      }
      resolve({ fields, files });
    });
  });
}