import PostgresPlugin from './postgres';
import { Logger } from '../utils/logger';

// Types for agent recordings
export interface AgentRecording {
    id?: string;
    name: string;
    description?: string;
    sequence: any; // JSONB data
    next_sequence_id?: number;
    repetitions?: number;
    created_at?: Date;
    updated_at?: Date;
    deleted_at?: Date | null;
}

// Types for scheduled recordings
export interface ScheduledRecording {
    id?: string;
    name: string;
    description?: string;
    code: string; // Cron expression
    sequenceId: string; // UUID reference to agent_recordings
    created_at?: Date;
    updated_at?: Date;
    deleted_at?: Date | null;
}

// Types for AI modes
export interface AiMode {
    id?: string;
    name: string;
    description?: string;
    ai_name?: string;
    system_message?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    top_k?: number;
    icon?: string;
    department?: string;
    is_active?: boolean;
    created_at?: Date;
    updated_at?: Date;
    deleted_at?: Date | null;
}

// Database query results
export interface QueryResult<T> {
    success: boolean;
    data?: T | T[] | undefined;
    error?: string;
    count?: number;
}

class AppApiPlugin {
    private postgres: PostgresPlugin;
    private logger: Logger;

    constructor(postgres: PostgresPlugin) {
        this.postgres = postgres;
        this.logger = new Logger('AppApi');
    }

    // ========================================
    // AGENT RECORDINGS CRUD OPERATIONS
    // ========================================

    /**
     * Create a new agent recording
     */
    async createAgentRecording(recording: AgentRecording): Promise<QueryResult<AgentRecording>> {
        this.logger.info("Creating agent recording", { recording });
        try {
            const query = `
                INSERT INTO agent_recordings (name, description, sequence, next_sequence_id, repetitions)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            
            const result = await this.postgres.query<AgentRecording>(query, [
                recording.name,
                recording.description || null,
                JSON.stringify(recording.sequence),
                recording.next_sequence_id || 1,
                recording.repetitions || 1
            ]);
            this.logger.info("Result on line 86:", result)

            if (result.rows.length > 0 && result.rows[0]) {
                this.logger.info('Agent recording created successfully', { id: result.rows[0].id });
                return { success: true, data: result.rows[0] };
            } else {
                return { success: false, error: 'Failed to create agent recording' };
            }
        } catch (error) {
            this.logger.error('Error creating agent recording', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Get all agent recordings (excluding deleted ones)
     */
    async getAllAgentRecordings(): Promise<QueryResult<AgentRecording[]>> {
        try {
            const query = `
                SELECT * FROM agent_recordings 
                WHERE deleted_at IS NULL 
                ORDER BY created_at DESC
            `;
            
            const result = await this.postgres.query<AgentRecording>(query);
            
            this.logger.info(`Retrieved ${result.rows.length} agent recordings`);
            return { success: true, data: result.rows, count: result.rows.length };
        } catch (error) {
            this.logger.error('Error retrieving agent recordings', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Get a single agent recording by ID
     */
    async getAgentRecordingById(id: string): Promise<QueryResult<AgentRecording>> {
        try {
            const query = `
                SELECT * FROM agent_recordings 
                WHERE id = $1 AND deleted_at IS NULL
            `;
            
            const result = await this.postgres.query<AgentRecording>(query, [id]);
            
            if (result.rows.length > 0) {
                return { success: true, data: result.rows[0] };
            } else {
                return { success: false, error: 'Agent recording not found' };
            }
        } catch (error) {
            this.logger.error('Error retrieving agent recording', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Update an agent recording
     */
    async updateAgentRecording(id: string, updates: Partial<AgentRecording>): Promise<QueryResult<AgentRecording>> {
        try {
            const setClauses: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            // Build dynamic update query
            if (updates.name !== undefined) {
                setClauses.push(`name = $${paramIndex++}`);
                values.push(updates.name);
            }
            if (updates.description !== undefined) {
                setClauses.push(`description = $${paramIndex++}`);
                values.push(updates.description);
            }
            if (updates.sequence !== undefined) {
                setClauses.push(`sequence = $${paramIndex++}`);
                values.push(JSON.stringify(updates.sequence));
            }
            if (updates.next_sequence_id !== undefined) {
                setClauses.push(`next_sequence_id = $${paramIndex++}`);
                values.push(updates.next_sequence_id);
            }
            if (updates.repetitions !== undefined) {
                setClauses.push(`repetitions = $${paramIndex++}`);
                values.push(updates.repetitions);
            }

            if (setClauses.length === 0) {
                return { success: false, error: 'No fields to update' };
            }

            values.push(id);
            const query = `
                UPDATE agent_recordings 
                SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex} AND deleted_at IS NULL
                RETURNING *
            `;
            
            const result = await this.postgres.query<AgentRecording>(query, values);
            
            if (result.rows.length > 0) {
                this.logger.info('Agent recording updated successfully', { id });
                return { success: true, data: result.rows[0] };
            } else {
                return { success: false, error: 'Agent recording not found or already deleted' };
            }
        } catch (error) {
            this.logger.error('Error updating agent recording', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Soft delete an agent recording
     */
    async deleteAgentRecording(id: string): Promise<QueryResult<boolean>> {
        try {
            const query = `
                UPDATE agent_recordings 
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND deleted_at IS NULL
                RETURNING id
            `;
            
            const result = await this.postgres.query(query, [id]);
            
            if (result.rows.length > 0) {
                this.logger.info('Agent recording soft deleted successfully', { id });
                return { success: true, data: true };
            } else {
                return { success: false, error: 'Agent recording not found or already deleted' };
            }
        } catch (error) {
            this.logger.error('Error deleting agent recording', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    // ========================================
    // SCHEDULED RECORDINGS CRUD OPERATIONS
    // ========================================

    /**
     * Create a new scheduled recording
     */
    async createScheduledRecording(recording: ScheduledRecording): Promise<QueryResult<ScheduledRecording>> {
        try {
            const query = `
                INSERT INTO scheduled_recordings (name, description, code, sequenceId)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            
            const result = await this.postgres.query<ScheduledRecording>(query, [
                recording.name,
                recording.description || null,
                recording.code,
                recording.sequenceId
            ]);

            if (result.rows.length > 0 && result.rows[0]) {
                this.logger.info('Scheduled recording created successfully', { id: result.rows[0].id });
                return { success: true, data: result.rows[0] };
            } else {
                return { success: false, error: 'Failed to create scheduled recording' };
            }
        } catch (error) {
            this.logger.error('Error creating scheduled recording', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Get all scheduled recordings (excluding deleted ones)
     */
    async getAllScheduledRecordings(): Promise<QueryResult<ScheduledRecording[]>> {
        try {
            const query = `
                SELECT * FROM scheduled_recordings 
                WHERE deleted_at IS NULL 
                ORDER BY created_at DESC
            `;
            
            const result = await this.postgres.query<ScheduledRecording>(query);
            
            this.logger.info(`Retrieved ${result.rows.length} scheduled recordings`);
            return { success: true, data: result.rows, count: result.rows.length };
        } catch (error) {
            this.logger.error('Error retrieving scheduled recordings', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Get scheduled recordings with their associated agent recording details
     */
    async getScheduledRecordingsWithDetails(): Promise<QueryResult<any[]>> {
        try {
            const query = `
                SELECT 
                    sr.*,
                    ar.name as sequence_name,
                    ar.description as sequence_description
                FROM scheduled_recordings sr
                LEFT JOIN agent_recordings ar ON sr.sequenceId = ar.id
                WHERE sr.deleted_at IS NULL 
                ORDER BY sr.created_at DESC
            `;
            
            const result = await this.postgres.query(query);
            
            this.logger.info(`Retrieved ${result.rows.length} scheduled recordings with details`);
            return { success: true, data: result.rows, count: result.rows.length };
        } catch (error) {
            this.logger.error('Error retrieving scheduled recordings with details', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Get a single scheduled recording by ID
     */
    async getScheduledRecordingById(id: string): Promise<QueryResult<ScheduledRecording>> {
        try {
            const query = `
                SELECT * FROM scheduled_recordings 
                WHERE id = $1 AND deleted_at IS NULL
            `;
            
            const result = await this.postgres.query<ScheduledRecording>(query, [id]);
            
            if (result.rows.length > 0) {
                return { success: true, data: result.rows[0] };
            } else {
                return { success: false, error: 'Scheduled recording not found' };
            }
        } catch (error) {
            this.logger.error('Error retrieving scheduled recording', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Update a scheduled recording
     */
    async updateScheduledRecording(id: string, updates: Partial<ScheduledRecording>): Promise<QueryResult<ScheduledRecording>> {
        try {
            const setClauses: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            // Build dynamic update query
            if (updates.name !== undefined) {
                setClauses.push(`name = $${paramIndex++}`);
                values.push(updates.name);
            }
            if (updates.description !== undefined) {
                setClauses.push(`description = $${paramIndex++}`);
                values.push(updates.description);
            }
            if (updates.code !== undefined) {
                setClauses.push(`code = $${paramIndex++}`);
                values.push(updates.code);
            }
            if (updates.sequenceId !== undefined) {
                setClauses.push(`sequenceId = $${paramIndex++}`);
                values.push(updates.sequenceId);
            }

            if (setClauses.length === 0) {
                return { success: false, error: 'No fields to update' };
            }

            values.push(id);
            const query = `
                UPDATE scheduled_recordings 
                SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex} AND deleted_at IS NULL
                RETURNING *
            `;
            
            const result = await this.postgres.query<ScheduledRecording>(query, values);
            
            if (result.rows.length > 0) {
                this.logger.info('Scheduled recording updated successfully', { id });
                return { success: true, data: result.rows[0] };
            } else {
                return { success: false, error: 'Scheduled recording not found or already deleted' };
            }
        } catch (error) {
            this.logger.error('Error updating scheduled recording', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Soft delete a scheduled recording
     */
    async deleteScheduledRecording(id: string): Promise<QueryResult<boolean>> {
        try {
            const query = `
                UPDATE scheduled_recordings 
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND deleted_at IS NULL
                RETURNING id
            `;
            
            const result = await this.postgres.query(query, [id]);
            
            if (result.rows.length > 0) {
                this.logger.info('Scheduled recording soft deleted successfully', { id });
                return { success: true, data: true };
            } else {
                return { success: false, error: 'Scheduled recording not found or already deleted' };
            }
        } catch (error) {
            this.logger.error('Error deleting scheduled recording', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    // ========================================
    // AI MODES CRUD OPERATIONS
    // ========================================

    /**
     * Create a new AI mode
     */
    async createAiMode(mode: AiMode): Promise<QueryResult<AiMode>> {
        try {
            const query = `
                INSERT INTO ai_modes (name, description, ai_name, system_message, temperature, max_tokens, top_p, top_k, icon, department, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;
            
            const result = await this.postgres.query<AiMode>(query, [
                mode.name,
                mode.description || null,
                mode.ai_name || 'Silma AI',
                mode.system_message || null,
                mode.temperature || 0.7,
                mode.max_tokens || 4096,
                mode.top_p || 0.8,
                mode.top_k || 40,
                mode.icon || null,
                mode.department || null,
                mode.is_active !== false // Default to true
            ]);

            if (result.rows.length > 0 && result.rows[0]) {
                this.logger.info('AI mode created successfully', { id: result.rows[0].id });
                return { success: true, data: result.rows[0] };
            } else {
                return { success: false, error: 'Failed to create AI mode' };
            }
        } catch (error) {
            this.logger.error('Error creating AI mode', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Get all AI modes (excluding deleted ones)
     */
    async getAllAiModes(): Promise<QueryResult<AiMode[]>> {
        try {
            const query = `
                SELECT * FROM ai_modes 
                WHERE deleted_at IS NULL 
                ORDER BY created_at DESC
            `;
            
            const result = await this.postgres.query<AiMode>(query);
            
            this.logger.info(`Retrieved ${result.rows.length} AI modes`);
            return { success: true, data: result.rows, count: result.rows.length };
        } catch (error) {
            this.logger.error('Error retrieving AI modes', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Get active AI modes only
     */
    async getActiveAiModes(): Promise<QueryResult<AiMode[]>> {
        try {
            const query = `
                SELECT * FROM ai_modes 
                WHERE deleted_at IS NULL AND is_active = true
                ORDER BY created_at DESC
            `;
            
            const result = await this.postgres.query<AiMode>(query);
            
            this.logger.info(`Retrieved ${result.rows.length} active AI modes`);
            return { success: true, data: result.rows, count: result.rows.length };
        } catch (error) {
            this.logger.error('Error retrieving active AI modes', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Get AI modes by department
     */
    async getAiModesByDepartment(department: string): Promise<QueryResult<AiMode[]>> {
        try {
            const query = `
                SELECT * FROM ai_modes 
                WHERE deleted_at IS NULL AND department = $1
                ORDER BY created_at DESC
            `;
            
            const result = await this.postgres.query<AiMode>(query, [department]);
            
            this.logger.info(`Retrieved ${result.rows.length} AI modes for department: ${department}`);
            return { success: true, data: result.rows, count: result.rows.length };
        } catch (error) {
            this.logger.error('Error retrieving AI modes by department', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Get a single AI mode by ID
     */
    async getAiModeById(id: string): Promise<QueryResult<AiMode>> {
        try {
            const query = `
                SELECT * FROM ai_modes 
                WHERE id = $1 AND deleted_at IS NULL
            `;
            
            const result = await this.postgres.query<AiMode>(query, [id]);
            
            if (result.rows.length > 0) {
                return { success: true, data: result.rows[0] };
            } else {
                return { success: false, error: 'AI mode not found' };
            }
        } catch (error) {
            this.logger.error('Error retrieving AI mode', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Update an AI mode
     */
    async updateAiMode(id: string, updates: Partial<AiMode>): Promise<QueryResult<AiMode>> {
        try {
            const setClauses: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            // Build dynamic update query
            if (updates.name !== undefined) {
                setClauses.push(`name = $${paramIndex++}`);
                values.push(updates.name);
            }
            if (updates.description !== undefined) {
                setClauses.push(`description = $${paramIndex++}`);
                values.push(updates.description);
            }
            if (updates.ai_name !== undefined) {
                setClauses.push(`ai_name = $${paramIndex++}`);
                values.push(updates.ai_name);
            }
            if (updates.system_message !== undefined) {
                setClauses.push(`system_message = $${paramIndex++}`);
                values.push(updates.system_message);
            }
            if (updates.temperature !== undefined) {
                setClauses.push(`temperature = $${paramIndex++}`);
                values.push(updates.temperature);
            }
            if (updates.max_tokens !== undefined) {
                setClauses.push(`max_tokens = $${paramIndex++}`);
                values.push(updates.max_tokens);
            }
            if (updates.top_p !== undefined) {
                setClauses.push(`top_p = $${paramIndex++}`);
                values.push(updates.top_p);
            }
            if (updates.top_k !== undefined) {
                setClauses.push(`top_k = $${paramIndex++}`);
                values.push(updates.top_k);
            }
            if (updates.icon !== undefined) {
                setClauses.push(`icon = $${paramIndex++}`);
                values.push(updates.icon);
            }
            if (updates.department !== undefined) {
                setClauses.push(`department = $${paramIndex++}`);
                values.push(updates.department);
            }
            if (updates.is_active !== undefined) {
                setClauses.push(`is_active = $${paramIndex++}`);
                values.push(updates.is_active);
            }

            if (setClauses.length === 0) {
                return { success: false, error: 'No fields to update' };
            }

            values.push(id);
            const query = `
                UPDATE ai_modes 
                SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex} AND deleted_at IS NULL
                RETURNING *
            `;
            
            const result = await this.postgres.query<AiMode>(query, values);
            
            if (result.rows.length > 0) {
                this.logger.info('AI mode updated successfully', { id });
                return { success: true, data: result.rows[0] };
            } else {
                return { success: false, error: 'AI mode not found or already deleted' };
            }
        } catch (error) {
            this.logger.error('Error updating AI mode', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Soft delete an AI mode
     */
    async deleteAiMode(id: string): Promise<QueryResult<boolean>> {
        try {
            const query = `
                UPDATE ai_modes 
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND deleted_at IS NULL
                RETURNING id
            `;
            
            const result = await this.postgres.query(query, [id]);
            
            if (result.rows.length > 0) {
                this.logger.info('AI mode soft deleted successfully', { id });
                return { success: true, data: true };
            } else {
                return { success: false, error: 'AI mode not found or already deleted' };
            }
        } catch (error) {
            this.logger.error('Error deleting AI mode', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Toggle AI mode active status
     */
    async toggleAiModeActive(id: string): Promise<QueryResult<AiMode>> {
        try {
            const query = `
                UPDATE ai_modes 
                SET is_active = NOT is_active
                WHERE id = $1 AND deleted_at IS NULL
                RETURNING *
            `;
            
            const result = await this.postgres.query<AiMode>(query, [id]);
            
            if (result.rows.length > 0 && result.rows[0]) {
                this.logger.info('AI mode active status toggled successfully', { id, is_active: result.rows[0].is_active });
                return { success: true, data: result.rows[0] };
            } else {
                return { success: false, error: 'AI mode not found or already deleted' };
            }
        } catch (error) {
            this.logger.error('Error toggling AI mode active status', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Get database health status
     */
    async getHealthStatus(): Promise<QueryResult<any>> {
        try {
            const result = await this.postgres.healthCheck();
            return { 
                success: true, 
                data: { 
                    status: 'healthy', 
                    timestamp: new Date().toISOString(),
                    database: result 
                } 
            };
        } catch (error) {
            this.logger.error('Database health check failed', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error',
                data: { 
                    status: 'unhealthy', 
                    timestamp: new Date().toISOString() 
                } 
            };
        }
    }

    /**
     * Get database statistics
     */
    async getDatabaseStats(): Promise<QueryResult<any>> {
        try {
            const stats = await this.postgres.getStats();
            return { success: true, data: stats };
        } catch (error) {
            this.logger.error('Error getting database stats', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}

export default AppApiPlugin;