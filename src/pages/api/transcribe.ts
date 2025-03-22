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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the incoming form data
    const { fields, files } = await parseForm(req);
    
    if (!files.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    const file = files.file as any;
    
    // Transcribe the audio using OpenAI's latest Whisper model
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(file.filepath),
      model: 'whisper-1', // Using whisper-1 which is the latest available model
      response_format: 'json',
      temperature: 0.2, // Lower temperature for more accurate transcriptions
    });
    
    // Clean up the temporary file
    await fs.unlink(file.filepath);
    
    console.log('[transcribe] Transcription successful');
    return res.status(200).json({ text: transcription.text });
  } catch (error: any) {
    console.error('[transcribe] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to transcribe audio',
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
      console.error('Error creating upload directory:', error);
    }
    
    const form = new IncomingForm({
      uploadDir,
      keepExtensions: true,
    });
    
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}