import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface FileMetadata {
  name: string;
  path: string;
  size: number;
  extension: string;
  modified: string;
  created: string;
  isDirectory: boolean;
}

export class MCPFilesystemClient {
  private client: Client | null = null;
  private isConnected: boolean = false;

  /**
   * Initialize the MCP Filesystem client
   * @param allowedPaths Array of paths the filesystem server can access
   */
  async initialize(allowedPaths: string[]): Promise<void> {
    try {
      console.log('[MCP] Initializing filesystem client with paths:', allowedPaths);

      // Create stdio transport to spawn filesystem server
      const transport = new StdioClientTransport({
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          ...allowedPaths
        ]
      });

      // Create MCP client
      this.client = new Client(
        {
          name: 'backtrack-client',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      // Connect to the server
      await this.client.connect(transport);
      this.isConnected = true;

      console.log('[MCP] Filesystem client connected successfully');
    } catch (error) {
      console.error('[MCP] Failed to initialize:', error);
      this.isConnected = false;
      throw new Error(`MCP initialization failed: ${error}`);
    }
  }

  /**
   * Read directory contents
   */
  async readDirectory(path: string, recursive: boolean = false): Promise<FileMetadata[]> {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Reading directory: ${path}, recursive: ${recursive}`);

      const result = await this.client.callTool({
        name: 'read_directory',
        arguments: {
          path: path
        }
      });

      // Parse the result
      const files = this.parseDirectoryResult(result, path, recursive);
      console.log(`[MCP] Found ${files.length} items in ${path}`);

      return files;
    } catch (error) {
      console.error(`[MCP] Error reading directory ${path}:`, error);
      throw error;
    }
  }

  /**
   * Read file contents
   */
  async readFile(path: string): Promise<string> {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Reading file: ${path}`);

      const result = await this.client.callTool({
        name: 'read_file',
        arguments: {
          path: path
        }
      });

      return this.extractTextContent(result);
    } catch (error) {
      console.error(`[MCP] Error reading file ${path}:`, error);
      throw error;
    }
  }

  /**
   * Write file contents
   */
  async writeFile(path: string, content: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Writing file: ${path}`);

      await this.client.callTool({
        name: 'write_file',
        arguments: {
          path: path,
          content: content
        }
      });

      console.log(`[MCP] File written successfully: ${path}`);
    } catch (error) {
      console.error(`[MCP] Error writing file ${path}:`, error);
      throw error;
    }
  }

  /**
   * Create directory
   */
  async createDirectory(path: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Creating directory: ${path}`);

      await this.client.callTool({
        name: 'create_directory',
        arguments: {
          path: path
        }
      });

      console.log(`[MCP] Directory created: ${path}`);
    } catch (error) {
      console.error(`[MCP] Error creating directory ${path}:`, error);
      throw error;
    }
  }

  /**
   * Move file or directory
   */
  async moveFile(source: string, destination: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP] Moving: ${source} -> ${destination}`);

      await this.client.callTool({
        name: 'move_file',
        arguments: {
          source: source,
          destination: destination
        }
      });

      console.log(`[MCP] Moved successfully`);
    } catch (error) {
      console.error(`[MCP] Error moving file:`, error);
      throw error;
    }
  }

  /**
   * Check connection status
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Parse directory listing result from MCP
   */
  private parseDirectoryResult(result: any, basePath: string, _recursive: boolean): FileMetadata[] {
    const files: FileMetadata[] = [];

    try {
      // MCP returns content as array of text/image blocks
      if (result.content && Array.isArray(result.content)) {
        for (const block of result.content) {
          if (block.type === 'text' && block.text) {
            // Parse the text content (it's usually a list of files)
            const lines = block.text.split('\n').filter((line: string) => line.trim());

            for (const line of lines) {
              // Each line is typically a filename or directory
              const trimmed = line.trim();
              if (trimmed && trimmed !== '.' && trimmed !== '..') {
                const fullPath = `${basePath}\\${trimmed}`;
                const isDir = trimmed.endsWith('/') || !trimmed.includes('.');

                files.push({
                  name: trimmed.replace(/\/$/, ''),
                  path: fullPath,
                  size: 0, // MCP doesn't provide size in directory listing
                  extension: isDir ? '' : this.getExtension(trimmed),
                  modified: new Date().toISOString(),
                  created: new Date().toISOString(),
                  isDirectory: isDir
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[MCP] Error parsing directory result:', error);
    }

    return files;
  }

  /**
   * Extract text content from MCP result
   */
  private extractTextContent(result: any): string {
    if (result.content && Array.isArray(result.content)) {
      for (const block of result.content) {
        if (block.type === 'text' && block.text) {
          return block.text;
        }
      }
    }
    return '';
  }

  /**
   * Get file extension
   */
  private getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        console.log('[MCP] Client disconnected');
      } catch (error) {
        console.error('[MCP] Error disconnecting:', error);
      }
      this.isConnected = false;
      this.client = null;
    }
  }
}

// Singleton instance
let mcpInstance: MCPFilesystemClient | null = null;

export async function getMCPClient(allowedPaths?: string[]): Promise<MCPFilesystemClient> {
  if (!mcpInstance) {
    mcpInstance = new MCPFilesystemClient();
    if (allowedPaths) {
      await mcpInstance.initialize(allowedPaths);
    }
  }
  return mcpInstance;
}
