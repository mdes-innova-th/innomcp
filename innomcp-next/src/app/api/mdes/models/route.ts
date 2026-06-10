// src/app/api/mdes/models/route.ts
import { NextResponse } from 'next/server';

const MDES_OLLAMA = 'https://ollama.mdes-innova.online';

export const dynamic = 'force-dynamic';

// Type definitions for Ollama API response
interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  details: {
    parameter_size: string;
    [key: string]: unknown;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

// Transformed model shape for our API
interface TransformedModel {
  name: string;
  size: number;
  modified_at: string;
  parameterSize: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    const response = await fetch(`${MDES_OLLAMA}/api/tags`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`MDES Ollama returned status ${response.status}`);
    }

    const data: OllamaTagsResponse = await response.json();

    if (!Array.isArray(data?.models)) {
      throw new Error('Invalid response format from Ollama: missing models array');
    }

    const transformedModels: TransformedModel[] = data.models.map((model) => ({
      name: model.name,
      size: model.size,
      modified_at: model.modified_at,
      parameterSize: model.details?.parameter_size ?? '',
    }));

    return NextResponse.json(
      {
        models: transformedModels,
        total: transformedModels.length,
        healthy: true,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      },
    );
  } catch (error) {
    console.error('Failed to fetch models from MDES Ollama:', error);

    return NextResponse.json(
      { models: [], total: 0, healthy: false },
      {
        status: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      },
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}