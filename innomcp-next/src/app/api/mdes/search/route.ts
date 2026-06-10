import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_BASE_URL = 'https://ollama.mdes-innova.online';

interface OllamaModelDetail {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: OllamaModelDetail;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

interface SearchModel {
  name: string;
  size: number;
  modified_at: string;
  parameterSize: string;
  family: string;
}

interface SearchResponse {
  models: SearchModel[];
  query: string;
  total: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q') || '';
  const family = searchParams.get('model') || undefined; // param 'model' for family
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const sort = searchParams.get('sort') || 'name';
  const order = searchParams.get('order') || 'asc';

  // Validate pagination
  if (page < 1 || limit < 1 || limit > 100) {
    return NextResponse.json({ error: 'Invalid page or limit' }, { status: 400 });
  }

  try {
    // Fetch from MDES Ollama with 5-minute cache revalidation
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: 502 });
    }

    const data: OllamaTagsResponse = await res.json();

    // Map into our response shape
    let models: SearchModel[] = data.models.map((m) => ({
      name: m.name,
      size: m.size,
      modified_at: m.modified_at,
      parameterSize: m.details.parameter_size,
      family: m.details.family || m.name.split(':')[0], // fallback incase details.family is missing
    }));

    // Filter by query (case-insensitive)
    if (q) {
      const lowerQ = q.toLowerCase();
      models = models.filter((m) => m.name.toLowerCase().includes(lowerQ));
    }

    // Filter by family (case-insensitive)
    if (family) {
      const lowerFamily = family.toLowerCase();
      models = models.filter((m) => m.family.toLowerCase() === lowerFamily);
    }

    // Sort
    const sortOrder = order === 'desc' ? -1 : 1;
    models.sort((a, b) => {
      let cmp = 0;
      if (sort === 'size') {
        cmp = a.size - b.size;
      } else if (sort === 'modified_at') {
        cmp = a.modified_at.localeCompare(b.modified_at);
      } else {
        // default: name
        cmp = a.name.localeCompare(b.name);
      }
      return cmp * sortOrder;
    });

    const total = models.length;

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedModels = models.slice(startIndex, startIndex + limit);

    const response: SearchResponse = {
      models: paginatedModels,
      query: q,
      total,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}