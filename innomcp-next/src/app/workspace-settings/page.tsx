'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBriefcase, 
  faPlus, 
  faSave, 
  faTrash, 
  faPalette, 
  faGlobe, 
  faClock,
  faSpinner,
  faEdit,
  faCheck,
  faTimes
} from '@fortawesome/free-solid-svg-icons';

interface Workspace {
  workspace_id: number;
  workspace_name: string;
  workspace_slug: string;
  description: string | null;
  theme: string;
  color_scheme: string;
  language: string;
  timezone: string | null;
  storage_quota_mb: number;
  storage_used_mb: number;
  is_default: boolean;
  is_active: boolean;
  file_count?: number;
}

interface Instruction {
  instruction_id: number;
  instruction_type: string;
  instruction_text: string;
  priority: number;
  is_active: boolean;
}

export default function WorkspaceSettingsPage() {
  const { isLoggedIn, isAuthLoading } = useAuth();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingTheme, setEditingTheme] = useState('auto');
  const [editingLanguage, setEditingLanguage] = useState('en');
  
  const [newInstruction, setNewInstruction] = useState({ type: 'system', text: '' });
  const [showNewInstruction, setShowNewInstruction] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, isAuthLoading, router]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchWorkspaces();
    }
  }, [isLoggedIn]);

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('http://localhost:3015/api/workspace', {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch workspaces');

      const data = await response.json();
      setWorkspaces(data.data);
      
      // Select first workspace by default
      if (data.data.length > 0) {
        selectWorkspace(data.data[0]);
      }
    } catch (err) {
      setError('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const selectWorkspace = async (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setEditingName(workspace.workspace_name);
    setEditingDescription(workspace.description || '');
    setEditingTheme(workspace.theme);
    setEditingLanguage(workspace.language);

    // Fetch instructions
    try {
      const response = await fetch(`http://localhost:3015/api/workspace/${workspace.workspace_id}/instructions`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setInstructions(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch instructions:', err);
    }
  };

  const handleSave = async () => {
    if (!selectedWorkspace) return;

    setSaving(true);
    setError('');

    try {
      const response = await fetch(`http://localhost:3015/api/workspace/${selectedWorkspace.workspace_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingName,
          description: editingDescription,
          theme: editingTheme,
          language: editingLanguage
        }),
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to save');

      // Refresh workspaces
      await fetchWorkspaces();
    } catch (err) {
      setError('Failed to save workspace settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddInstruction = async () => {
    if (!selectedWorkspace || !newInstruction.text.trim()) return;

    try {
      const response = await fetch(`http://localhost:3015/api/workspace/${selectedWorkspace.workspace_id}/instructions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newInstruction.type,
          text: newInstruction.text
        }),
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to add instruction');

      // Refresh instructions
      await selectWorkspace(selectedWorkspace);
      setNewInstruction({ type: 'system', text: '' });
      setShowNewInstruction(false);
    } catch (err) {
      setError('Failed to add instruction');
    }
  };

  const handleDeleteInstruction = async (instructionId: number) => {
    if (!selectedWorkspace) return;

    try {
      const response = await fetch(
        `http://localhost:3015/api/workspace/${selectedWorkspace.workspace_id}/instructions/${instructionId}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      );

      if (!response.ok) throw new Error('Failed to delete instruction');

      // Refresh instructions
      await selectWorkspace(selectedWorkspace);
    } catch (err) {
      setError('Failed to delete instruction');
    }
  };

  if (isAuthLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <FontAwesomeIcon icon={faSpinner} className="text-4xl text-primary animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FontAwesomeIcon icon={faBriefcase} className="text-primary" />
            Workspace Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your workspaces and customize AI behavior
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workspace List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Your Workspaces
              </h2>
              
              <div className="space-y-2">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.workspace_id}
                    onClick={() => selectWorkspace(workspace)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedWorkspace?.workspace_id === workspace.workspace_id
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {workspace.workspace_name}
                      {workspace.is_default && (
                        <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {workspace.storage_used_mb}MB / {workspace.storage_quota_mb}MB used
                    </div>
                  </button>
                ))}
              </div>

              <button
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors"
              >
                <FontAwesomeIcon icon={faPlus} />
                New Workspace
              </button>
            </div>
          </div>

          {/* Workspace Details */}
          <div className="lg:col-span-2 space-y-6">
            {selectedWorkspace ? (
              <>
                {/* Basic Settings */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faEdit} className="text-primary" />
                    Basic Settings
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Workspace Name
                      </label>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Description
                      </label>
                      <textarea
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Describe this workspace..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <FontAwesomeIcon icon={faPalette} className="mr-2" />
                          Theme
                        </label>
                        <select
                          value={editingTheme}
                          onChange={(e) => setEditingTheme(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="auto">Auto</option>
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <FontAwesomeIcon icon={faGlobe} className="mr-2" />
                          Language
                        </label>
                        <select
                          value={editingLanguage}
                          onChange={(e) => setEditingLanguage(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="en">English</option>
                          <option value="th">ไทย</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faSave} />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Custom Instructions */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Custom Instructions
                    </h2>
                    <button
                      onClick={() => setShowNewInstruction(!showNewInstruction)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      <FontAwesomeIcon icon={showNewInstruction ? faTimes : faPlus} />
                      {showNewInstruction ? 'Cancel' : 'Add Instruction'}
                    </button>
                  </div>

                  {showNewInstruction && (
                    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="space-y-3">
                        <select
                          value={newInstruction.type}
                          onChange={(e) => setNewInstruction({ ...newInstruction, type: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="system">System</option>
                          <option value="personality">Personality</option>
                          <option value="behavior">Behavior</option>
                          <option value="constraint">Constraint</option>
                        </select>

                        <textarea
                          value={newInstruction.text}
                          onChange={(e) => setNewInstruction({ ...newInstruction, text: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Enter instruction..."
                        />

                        <button
                          onClick={handleAddInstruction}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                        >
                          <FontAwesomeIcon icon={faCheck} />
                          Add Instruction
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {instructions.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No custom instructions yet
                      </p>
                    ) : (
                      instructions.map((instruction) => (
                        <div
                          key={instruction.instruction_id}
                          className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex-1">
                            <span className="inline-block px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded mb-2">
                              {instruction.instruction_type}
                            </span>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {instruction.instruction_text}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteInstruction(instruction.instruction_id)}
                            className="ml-4 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Select a workspace to view settings
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
