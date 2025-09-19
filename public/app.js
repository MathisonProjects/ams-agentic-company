// AMS Agentic Company - Main Application JavaScript

// Global state variables
let isConnected = false;
let systemMessage = '';
let aiName = 'Silma AI';
let temperature = 0.7;
let maxTokens = 4096;
let topP = 0.8;
let topK = 40;
let currentMode = null;
let modes = [];
let filteredModes = [];
let strategies = [];
let filteredStrategies = [];
let isSequenceRecording = false; // Track if we're currently recording a sequence
let conversationHistory = [
    {
        role: 'assistant',
        parts: [{ text: 'Hello! I\'m ready to help you with any questions or tasks. What would you like to know?' }],
        timestamp: new Date()
    }
];
let attachedFiles = [];
let showAllModes = false; // Track whether to show all modes or only active ones

// Status Management
function updateStatus(status, text) {
    const statusEl = document.getElementById('status');
    const statusTextEl = document.getElementById('statusText');
    
    // Update icon based on status
    const icon = statusEl.querySelector('.material-icons');
    
    statusEl.className = `status-chip ${status}`;
    statusTextEl.textContent = text;
    
    switch(status) {
        case 'connected':
            icon.textContent = 'check_circle';
            break;
        case 'loading':
            icon.textContent = 'hourglass_empty';
            break;
        case 'disconnected':
            icon.textContent = 'error';
            break;
    }
}

// API Functions
async function sendPrompt() {
    const prompt = document.getElementById('prompt').value.trim();
    if (!prompt && attachedFiles.length === 0) {
        alert('Please enter a prompt or attach files');
        return;
    }

    // Disable buttons
    document.getElementById('sendBtn').disabled = true;
    document.getElementById('streamBtn').disabled = true;
    updateStatus('loading', 'Uploading files and sending prompt...');

    try {
        // Upload files first
        const uploadedFiles = await uploadFiles();
        
        // Create user message parts
        const userParts = [];
        if (prompt) {
            userParts.push({ text: prompt });
        }
        
        // Add file parts
        for (const file of uploadedFiles) {
            userParts.push({
                file: {
                    id: file.id,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    path: file.path
                }
            });
        }

        // Add user message to conversation history
        const userMessage = {
            role: 'user',
            parts: userParts,
            timestamp: new Date()
        };
        conversationHistory.push(userMessage);

        const response = await fetch('/api/gemini/text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: conversationHistory,
                systemMessage: systemMessage,
                aiName: aiName,
                temperature,
                maxTokens,
                topP,
                topK,
                files: uploadedFiles
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Add assistant response to conversation history
        conversationHistory.push({
            role: 'assistant',
            parts: [{ text: data.text }],
            timestamp: new Date()
        });
        
        // Add to conversation display
        addMessageWithFiles('user', prompt, uploadedFiles);
        addMessage('assistant', data.text);

        // Clear input and files
        document.getElementById('prompt').value = '';
        clearAttachedFiles();
        
        updateStatus('connected', 'Connected - Response received');

    } catch (error) {
        console.error('Error:', error);
        updateStatus('disconnected', 'Error: ' + error.message);
        addMessage('assistant', 'Sorry, there was an error processing your request. Please try again.');
    } finally {
        // Re-enable buttons
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('streamBtn').disabled = false;
    }
}

async function sendStreamPrompt() {
    const prompt = document.getElementById('prompt').value.trim();
    if (!prompt) {
        alert('Please enter a prompt');
        return;
    }

    // Disable buttons
    document.getElementById('sendBtn').disabled = true;
    document.getElementById('streamBtn').disabled = true;
    updateStatus('loading', 'Streaming response...');

    try {
        // Add user message to conversation history
        conversationHistory.push({
            role: 'user',
            parts: [{ text: prompt }]
        });

        // Add user message to display
        addMessage('user', prompt);

        // Create assistant message for streaming (ensure it's on the left)
        const assistantMessageId = addMessage('assistant', '<span class="streaming"></span> Streaming...');

        const response = await fetch('/api/gemini/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: conversationHistory,
                systemMessage: systemMessage,
                aiName: aiName,
                temperature,
                maxTokens,
                topP,
                topK
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        updateMessage(assistantMessageId, fullResponse);
                        
                        // Add assistant response to conversation history
                        conversationHistory.push({
                            role: 'assistant',
                            parts: [{ text: fullResponse }],
                            timestamp: new Date()
                        });
                        
                        updateStatus('connected', 'Connected - Stream completed');
                        break;
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.text) {
                            fullResponse += parsed.text;
                            updateMessage(assistantMessageId, fullResponse + '<span class="streaming"></span>');
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }
            }
        }

        // Clear input
        document.getElementById('prompt').value = '';

    } catch (error) {
        console.error('Error:', error);
        updateStatus('disconnected', 'Error: ' + error.message);
        addMessage('assistant', 'Sorry, there was an error processing your request. Please try again.');
    } finally {
        // Re-enable buttons
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('streamBtn').disabled = false;
    }
}

// Message Management
function addMessage(role, content) {
    const conversation = document.getElementById('conversation');
    const messageDiv = document.createElement('div');
    const messageId = 'msg-' + Date.now();
    messageDiv.id = messageId;
    messageDiv.className = `message ${role}`;
    
    const header = role === 'user' ? 'You' : aiName;
    
    // Only add actions menu for assistant messages
                const actionsMenu = role === 'assistant' ? `
                <div class="message-actions">
                    <button class="message-actions-button" onclick="toggleMessageMenu('${messageId}')">
                        <span class="material-icons">more_vert</span>
                    </button>
                    <div class="message-actions-menu" id="menu-${messageId}">
                        <div class="message-actions-menu-item" onclick="copyMessage('${messageId}')">
                            <span class="material-icons">content_copy</span>
                            Copy
                        </div>
                        <div class="message-actions-menu-item" onclick="continueMessage('${messageId}')">
                            <span class="material-icons">play_arrow</span>
                            Continue
                        </div>
                        <div class="message-actions-menu-item" onclick="regenerateMessage('${messageId}')">
                            <span class="material-icons">refresh</span>
                            Regenerate
                        </div>
                        <div class="message-actions-menu-item" onclick="deleteMessage('${messageId}')">
                            <span class="material-icons">delete</span>
                            Delete
                        </div>
                    </div>
                </div>
            ` : '';
    
    const timestamp = new Date().toLocaleTimeString();
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-header">
                <span>${header}</span>
                <span class="message-timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${content}</div>
            ${actionsMenu}
        </div>
    `;
    
    conversation.appendChild(messageDiv);
    conversation.scrollTop = conversation.scrollHeight;
    
    return messageId;
}

function updateMessage(messageId, content) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) {
        const contentDiv = messageDiv.querySelector('.message-content');
        if (contentDiv) {
            contentDiv.innerHTML = content;
        }
    }
}

function clearConversation() {
    const conversation = document.getElementById('conversation');
    const timestamp = new Date().toLocaleTimeString();
    conversation.innerHTML = `
        <div class="message assistant" id="initial-msg">
            <div class="message-bubble">
                <div class="message-header">
                    <span>${aiName}</span>
                    <span class="message-timestamp">${timestamp}</span>
                </div>
                <div class="message-content">Hello! I'm ready to help you with any questions or tasks. What would you like to know?</div>
                <div class="message-actions">
                    <button class="message-actions-button" onclick="toggleMessageMenu('initial-msg')">
                        <span class="material-icons">more_vert</span>
                    </button>
                    <div class="message-actions-menu" id="menu-initial-msg">
                        <div class="message-actions-menu-item" onclick="copyMessage('initial-msg')">
                            <span class="material-icons">content_copy</span>
                            Copy
                        </div>
                        <div class="message-actions-menu-item" onclick="regenerateMessage('initial-msg')">
                            <span class="material-icons">refresh</span>
                            Regenerate
                        </div>
                        <div class="message-actions-menu-item" onclick="deleteMessage('initial-msg')">
                            <span class="material-icons">delete</span>
                            Delete
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Reset conversation history
    conversationHistory = [
        {
            role: 'assistant',
            parts: [{ text: 'Hello! I\'m ready to help you with any questions or tasks. What would you like to know?' }]
        }
    ];
    
    // Clear attached files
    clearAttachedFiles();
}

function addMessageWithFiles(role, content, files = []) {
    const conversation = document.getElementById('conversation');
    const messageDiv = document.createElement('div');
    const messageId = 'msg-' + Date.now();
    messageDiv.id = messageId;
    messageDiv.className = `message ${role}`;
    
    const header = role === 'user' ? 'You' : aiName;
    
    // Create file attachments HTML
    let filesHtml = '';
    if (files && files.length > 0) {
        filesHtml = '<div class="message-files">';
        for (const file of files) {
            const icon = getFileIcon(file.type);
            const size = formatFileSize(file.size);
            filesHtml += `
                <div class="message-file">
                    <span class="material-icons message-file-icon">${icon}</span>
                    <div class="message-file-info">
                        <div class="message-file-name">${file.name}</div>
                        <div class="message-file-size">${size}</div>
                    </div>
                </div>
            `;
        }
        filesHtml += '</div>';
    }
    
    // Only add actions menu for assistant messages
    const actionsMenu = role === 'assistant' ? `
        <div class="message-actions">
            <button class="message-actions-button" onclick="toggleMessageMenu('${messageId}')">
                <span class="material-icons">more_vert</span>
            </button>
            <div class="message-actions-menu" id="menu-${messageId}">
                <div class="message-actions-menu-item" onclick="copyMessage('${messageId}')">
                    <span class="material-icons">content_copy</span>
                    Copy
                </div>
                <div class="message-actions-menu-item" onclick="continueMessage('${messageId}')">
                    <span class="material-icons">play_arrow</span>
                    Continue
                </div>
                <div class="message-actions-menu-item" onclick="regenerateMessage('${messageId}')">
                    <span class="material-icons">refresh</span>
                    Regenerate
                </div>
                <div class="message-actions-menu-item" onclick="deleteMessage('${messageId}')">
                    <span class="material-icons">delete</span>
                    Delete
                </div>
            </div>
        </div>
    ` : '';
    
    const timestamp = new Date().toLocaleTimeString();
    const contentHtml = content ? `<div class="message-content">${content}</div>` : '';
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-header">
                <span>${header}</span>
                <span class="message-timestamp">${timestamp}</span>
            </div>
            ${filesHtml}
            ${contentHtml}
            ${actionsMenu}
        </div>
    `;
    
    conversation.appendChild(messageDiv);
    conversation.scrollTop = conversation.scrollHeight;
    
    return messageId;
}

function clearAttachedFiles() {
    attachedFiles = [];
    const attachedFilesContainer = document.getElementById('attachedFiles');
    attachedFilesContainer.innerHTML = '';
    updateFileDropZoneVisibility();
}

// Message Actions
function toggleMessageMenu(messageId) {
    const menu = document.getElementById(`menu-${messageId}`);
    const allMenus = document.querySelectorAll('.message-actions-menu');
    
    // Close all other menus
    allMenus.forEach(m => {
        if (m !== menu) {
            m.classList.remove('show');
        }
    });
    
    // Toggle current menu
    menu.classList.toggle('show');
}

function deleteMessage(messageId) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) {
        // Remove from conversation history
        const messageIndex = conversationHistory.findIndex(msg => 
            msg.role === 'assistant' && 
            msg.parts[0].text === messageDiv.querySelector('.message-content').textContent
        );
        
        if (messageIndex !== -1) {
            conversationHistory.splice(messageIndex, 1);
        }
        
        // Remove from DOM
        messageDiv.remove();
        
        // Close menu
        document.getElementById(`menu-${messageId}`).classList.remove('show');
        
        updateStatus('connected', 'Message deleted');
    }
}

function continueMessage(messageId) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) {
        const contentDiv = messageDiv.querySelector('.message-content');
        const originalContent = contentDiv.textContent || contentDiv.innerText;
        
        // Find the assistant message to continue
        const assistantMessageIndex = conversationHistory.findIndex(msg => 
            msg.role === 'assistant' && msg.parts[0].text === originalContent
        );
        
        if (assistantMessageIndex !== -1) {
            // Create a continuation prompt
            const continuationPrompt = {
                role: 'user',
                parts: [{ text: 'Please continue from where you left off.' }],
                timestamp: new Date()
            };
            
            // Add continuation prompt to conversation history
            conversationHistory.push(continuationPrompt);
            
            // Show loading state
            contentDiv.innerHTML = originalContent + '<br><em>Continuing...</em>';
            
            // Send the request to continue
            const requestBody = {
                messages: conversationHistory,
                systemMessage: systemMessage,
                aiName: aiName,
                temperature: temperature,
                maxTokens: maxTokens,
                topP: topP,
                topK: topK
            };
            
            fetch('/api/gemini/text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            })
            .then(response => response.json())
            .then(data => {
                if (data.text) {
                    // Update the message content with continuation
                    contentDiv.textContent = originalContent + ' ' + data.text;
                    
                    // Update the conversation history with the continued response
                    conversationHistory[assistantMessageIndex] = {
                        role: 'assistant',
                        parts: [{ text: originalContent + ' ' + data.text }],
                        timestamp: new Date()
                    };
                    
                    updateStatus('connected', 'Message continued');
                } else {
                    contentDiv.textContent = originalContent;
                    updateStatus('disconnected', 'Failed to continue message');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                contentDiv.textContent = originalContent;
                updateStatus('disconnected', 'Failed to continue message');
            });
        }
        
        // Close menu
        document.getElementById(`menu-${messageId}`).classList.remove('show');
    }
}

function regenerateMessage(messageId) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) {
        const contentDiv = messageDiv.querySelector('.message-content');
        const originalContent = contentDiv.textContent || contentDiv.innerText;
        
        // Find the user message that prompted this response
        const userMessageIndex = conversationHistory.findIndex(msg => 
            msg.role === 'user' && 
            conversationHistory.indexOf(msg) < conversationHistory.findIndex(m => 
                m.role === 'assistant' && m.parts[0].text === originalContent
            )
        );
        
        if (userMessageIndex !== -1) {
            const userMessage = conversationHistory[userMessageIndex];
            
            // Remove the original response from history
            const responseIndex = conversationHistory.findIndex(msg => 
                msg.role === 'assistant' && msg.parts[0].text === originalContent
            );
            if (responseIndex !== -1) {
                conversationHistory.splice(responseIndex, 1);
            }
            
            // Show loading state
            contentDiv.innerHTML = '<em>Regenerating...</em>';
            
            // Send the request to regenerate with proper format
            const requestBody = {
                messages: [userMessage],
                systemMessage: systemMessage,
                aiName: aiName,
                temperature: temperature,
                maxTokens: maxTokens,
                topP: topP,
                topK: topK
            };
            
            fetch('/api/gemini/text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            })
            .then(response => response.json())
            .then(data => {
                if (data.text) {
                    // Update the message content
                    contentDiv.textContent = data.text;
                    
                    // Add to conversation history
                    conversationHistory.push({
                        role: 'assistant',
                        parts: [{ text: data.text }],
                        timestamp: new Date()
                    });
                    
                    updateStatus('connected', 'Message regenerated');
                } else {
                    contentDiv.textContent = 'Error regenerating message';
                    updateStatus('disconnected', 'Failed to regenerate message');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                contentDiv.textContent = 'Error regenerating message';
                updateStatus('disconnected', 'Failed to regenerate message');
            });
        }
        
        // Close menu
        document.getElementById(`menu-${messageId}`).classList.remove('show');
    }
}

function copyMessage(messageId) {
    const messageDiv = document.getElementById(messageId);
    const contentDiv = messageDiv.querySelector('.message-content');
    const content = contentDiv.textContent || contentDiv.innerText;
    
    navigator.clipboard.writeText(content).then(() => {
        updateStatus('connected', 'Message copied to clipboard');
        
        // Close menu
        document.getElementById(`menu-${messageId}`).classList.remove('show');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        updateStatus('disconnected', 'Failed to copy message');
    });
}

function copyConversation() {
    const conversationDiv = document.getElementById('conversation');
    const messages = conversationDiv.querySelectorAll('.message');
    
    let conversationText = `Conversation with ${aiName}\n`;
    conversationText += `Date: ${new Date().toLocaleDateString()}\n`;
    conversationText += `Time: ${new Date().toLocaleTimeString()}\n`;
    conversationText += '='.repeat(50) + '\n\n';
    
    messages.forEach(message => {
        const isUser = message.classList.contains('user');
        const header = message.querySelector('.message-header');
        const content = message.querySelector('.message-content');
        const timestamp = message.querySelector('.message-timestamp');
        
        const role = isUser ? 'User' : (header.textContent || aiName);
        const text = content.textContent || content.innerText;
        const time = timestamp ? timestamp.textContent : '';
        
        conversationText += `[${role}] ${time}\n`;
        conversationText += `${text}\n\n`;
    });
    
    navigator.clipboard.writeText(conversationText).then(() => {
        updateStatus('connected', 'Entire conversation copied to clipboard');
    }).catch(err => {
        console.error('Failed to copy conversation: ', err);
        updateStatus('disconnected', 'Failed to copy conversation');
    });
}

function copyLastResponse() {
    const conversationDiv = document.getElementById('conversation');
    const messages = conversationDiv.querySelectorAll('.message');
    
    // Find the last assistant message
    let lastResponse = null;
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (!message.classList.contains('user')) {
            const content = message.querySelector('.message-content');
            if (content) {
                lastResponse = content.textContent || content.innerText;
                break;
            }
        }
    }
    
    if (!lastResponse) {
        updateStatus('disconnected', 'No AI response found to copy');
        return;
    }
    
    navigator.clipboard.writeText(lastResponse).then(() => {
        updateStatus('connected', 'Last AI response copied to clipboard');
    }).catch(err => {
        console.error('Failed to copy last response: ', err);
        updateStatus('disconnected', 'Failed to copy last response');
    });
}

function createSequence() {
    console.log('Create/End Sequence button clicked!');
    console.log('Current conversation history:', conversationHistory);
    console.log('Current mode:', currentMode);
    
    // Toggle sequence recording state
    isSequenceRecording = !isSequenceRecording;
    
    // Find the sequence item in the dropdown
    const sequenceItem = document.querySelector('.actions-dropdown-item[onclick="createSequence()"]');
    const buttonIcon = sequenceItem?.querySelector('.material-icons');
    const buttonText = sequenceItem?.querySelector('span:not(.material-icons)');
    
    if (isSequenceRecording) {
        // Start recording sequence
        startSequenceRecording(sequenceItem, buttonIcon, buttonText);
    } else {
        // Stop recording sequence
        stopSequenceRecording(sequenceItem, buttonIcon, buttonText);
    }
}

async function startSequenceRecording(sequenceItem, buttonIcon, buttonText) {
    try {
        // Call the tracker start endpoint
        const response = await fetch('/api/tracker/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Switch to "End Sequence" state
            if (buttonIcon) buttonIcon.textContent = 'stop';
            if (buttonText) buttonText.textContent = 'End Sequence';
            if (sequenceItem) {
                sequenceItem.title = 'End sequence recording';
                sequenceItem.classList.add('recording');
            }
            
            console.log('Started sequence recording');
            updateStatus('connected', 'Sequence recording started');
        } else {
            // Revert the state if the API call failed
            isSequenceRecording = false;
            console.error('Failed to start sequence recording:', result.error);
            updateStatus('disconnected', 'Failed to start sequence recording');
        }
    } catch (error) {
        // Revert the state if there was an error
        isSequenceRecording = false;
        console.error('Error starting sequence recording:', error);
        updateStatus('disconnected', 'Error starting sequence recording');
    }
}

async function stopSequenceRecording(sequenceItem, buttonIcon, buttonText) {
    try {
        // Call the tracker stop endpoint
        const response = await fetch('/api/tracker/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Switch back to "Create Sequence" state
            if (buttonIcon) buttonIcon.textContent = 'edit';
            if (buttonText) buttonText.textContent = 'Create Sequence';
            if (sequenceItem) {
                sequenceItem.title = 'Create sequence from conversation';
                sequenceItem.classList.remove('recording');
            }
            
            console.log('Ended sequence recording');
            updateStatus('connected', 'Sequence recording ended');
            
            // Show the sequence modal
            await showSequenceModal();
        } else {
            // Keep the recording state if the API call failed
            isSequenceRecording = true;
            console.error('Failed to stop sequence recording:', result.error);
            updateStatus('disconnected', 'Failed to stop sequence recording');
        }
    } catch (error) {
        // Keep the recording state if there was an error
        isSequenceRecording = true;
        console.error('Error stopping sequence recording:', error);
        updateStatus('disconnected', 'Error stopping sequence recording');
    }
}

async function executeRecordedSequence() {
    try {
        const response = await fetch('/api/plan/execute-recorded', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speed: 1.0 })
        });
        const result = await response.json();
        
        if (result.success) {
            console.log('Recorded sequence execution started');
        } else {
            console.error('Failed to execute recorded sequence:', result.error);
            updateStatus('disconnected', 'Failed to execute sequence: ' + result.error);
        }
    } catch (error) {
        console.error('Error executing recorded sequence:', error);
        updateStatus('disconnected', 'Error executing sequence');
    }
}

async function showSequenceModal() {
    try {
        // Get the recorded sequence data
        const response = await fetch('/api/tracker/sequence');
        const result = await response.json();
        
        if (!result.success) {
            console.error('Failed to get recorded sequence:', result.error);
            updateStatus('disconnected', 'Failed to get recorded sequence');
            return;
        }
        
        // Populate the modal with sequence data
        const modal = document.getElementById('sequenceModal');
        const jsonDisplay = document.getElementById('sequenceJson');
        const eventCount = document.getElementById('sequenceEventCount');
        const duration = document.getElementById('sequenceDuration');
        
        if (jsonDisplay) {
            jsonDisplay.textContent = JSON.stringify(result.data.plan, null, 2);
        }
        
        if (eventCount) {
            eventCount.textContent = result.data.eventCount;
        }
        
        if (duration) {
            const durationMs = result.data.duration;
            const durationSec = Math.round(durationMs / 1000);
            duration.textContent = `${durationSec} seconds`;
        }
        
        // Clear the form fields
        document.getElementById('sequenceName').value = '';
        document.getElementById('sequenceDescription').value = '';
        
        // Show the modal
        modal.classList.add('show');
        
    } catch (error) {
        console.error('Error showing sequence modal:', error);
        updateStatus('disconnected', 'Error showing sequence modal');
    }
}

function closeSequenceModal() {
    const modal = document.getElementById('sequenceModal');
    modal.classList.remove('show');
}

async function saveSequence() {
    try {
        const name = document.getElementById('sequenceName').value.trim();
        const description = document.getElementById('sequenceDescription').value.trim();
        
        if (!name) {
            alert('Sequence name is required');
            return;
        }
        
        // Get the current sequence data
        const response = await fetch('/api/tracker/sequence');
        const result = await response.json();
        
        if (!result.success) {
            console.error('Failed to get recorded sequence:', result.error);
            updateStatus('disconnected', 'Failed to get recorded sequence');
            return;
        }
        
        // Save to database
        const saveResponse = await fetch('/api/recordings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                description: description,
                sequence: result.data.plan
            })
        });
        
        const saveResult = await saveResponse.json();
        
        if (saveResult.success) {
            closeSequenceModal();
            updateStatus('connected', 'Sequence saved successfully');
            
            setTimeout(() => {
                updateStatus('connected', 'Connected - Ready to chat');
            }, 2000);
        } else {
            console.error('Failed to save sequence:', saveResult.error);
            updateStatus('disconnected', 'Failed to save sequence: ' + saveResult.error);
        }
        
    } catch (error) {
        console.error('Error saving sequence:', error);
        updateStatus('disconnected', 'Error saving sequence');
    }
}

async function deleteSequence(sequenceId) {
    if (!confirm('Are you sure you want to delete this sequence? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/recordings/${sequenceId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateStatus('connected', 'Sequence deleted successfully');
            
            // Reload the strategies list to reflect the deletion
            await loadStrategies();
            
            setTimeout(() => {
                updateStatus('connected', 'Connected - Ready to chat');
            }, 2000);
        } else {
            console.error('Failed to delete sequence:', result.error);
            updateStatus('disconnected', 'Failed to delete sequence: ' + result.error);
        }
        
    } catch (error) {
        console.error('Error deleting sequence:', error);
        updateStatus('disconnected', 'Error deleting sequence');
    }
}

function searchModes(query) {
    const searchQuery = query.toLowerCase().trim();
    
    if (searchQuery === '') {
        filteredModes = [...modes];
    } else {
        filteredModes = modes.filter(mode => 
            mode.name.toLowerCase().includes(searchQuery) ||
            mode.aiName.toLowerCase().includes(searchQuery) ||
            mode.systemPrompt.toLowerCase().includes(searchQuery)
        );
    }
    
    renderModesList();
    
    // Show/hide clear button
    const clearButton = document.getElementById('searchClear');
    if (clearButton) {
        clearButton.style.display = searchQuery === '' ? 'none' : 'flex';
    }
}

function clearModesSearch() {
    const searchInput = document.getElementById('modesSearch');
    if (searchInput) {
        searchInput.value = '';
        searchModes('');
    }
}

function renderModesList() {
    const modesList = document.getElementById('modesList');
    if (!modesList) return;
    
    modesList.innerHTML = '';
    
    if (filteredModes.length === 0) {
        modesList.innerHTML = `
            <div class="no-results">
                <span class="material-icons">search_off</span>
                <p>No modes found</p>
            </div>
        `;
        return;
    }
    
    filteredModes.forEach((mode, index) => {
        const modeItem = document.createElement('div');
        modeItem.className = `mode-item ${!mode.is_active ? 'inactive' : ''}`;
        
        const icon = mode.icon || 'psychology'; // Default icon if none specified
        modeItem.innerHTML = `
            <div class="mode-header" onclick="selectMode(${JSON.stringify(mode).replace(/"/g, '&quot;')})">
                <span class="material-icons mode-icon">${icon}</span>
                <div class="mode-info">
                    <div class="mode-name">${mode.name}</div>
                    <div class="mode-ai-name">${mode.aiName}</div>
                    ${!mode.is_active ? '<div class="mode-status inactive">Inactive</div>' : ''}
                </div>
            </div>
            <div class="mode-actions">
                <button class="mode-action-button" onclick="openEditModeModal(${JSON.stringify(mode).replace(/"/g, '&quot;')})" title="Edit mode">
                    <span class="material-icons">edit</span>
                </button>
                <button class="mode-action-button" onclick="toggleModeActive('${mode.id}')" title="${mode.is_active ? 'Deactivate' : 'Activate'} mode">
                    <span class="material-icons">${mode.is_active ? 'visibility' : 'visibility_off'}</span>
                </button>
                <button class="mode-action-button" onclick="deleteMode('${mode.id}')" title="Delete mode">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        `;
        
        modesList.appendChild(modeItem);
    });
}

// Modal Management
function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const systemMessageField = document.getElementById('systemMessage');
    const aiNameField = document.getElementById('aiName');
    
    // Load current settings
    systemMessageField.value = systemMessage;
    aiNameField.value = aiName;
    
    // Load current slider values
    document.getElementById('modalTemperature').value = temperature;
    document.getElementById('modalMaxTokens').value = maxTokens;
    document.getElementById('modalTopP').value = topP;
    document.getElementById('modalTopK').value = topK;
    
    // Update display values
    document.getElementById('modalTempValue').textContent = temperature;
    document.getElementById('modalTokenValue').textContent = maxTokens;
    document.getElementById('modalTopPValue').textContent = topP;
    document.getElementById('modalTopKValue').textContent = topK;
    
    modal.classList.add('show');
    systemMessageField.focus();
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
}

function saveSettings() {
    const systemMessageField = document.getElementById('systemMessage');
    const aiNameField = document.getElementById('aiName');
    
    systemMessage = systemMessageField.value.trim();
    aiName = aiNameField.value.trim() || 'Silma AI';
    
    // Save slider values
    temperature = parseFloat(document.getElementById('modalTemperature').value);
    maxTokens = parseInt(document.getElementById('modalMaxTokens').value);
    topP = parseFloat(document.getElementById('modalTopP').value);
    topK = parseInt(document.getElementById('modalTopK').value);
    
    closeSettingsModal();
    
    // Update the initial message header with the new AI name
    const initialHeader = document.getElementById('initialAiHeader');
    if (initialHeader) {
        initialHeader.textContent = aiName;
    }
    
    // Show confirmation
    updateStatus('connected', 'Settings saved successfully');
    
    setTimeout(() => {
        updateStatus('connected', 'Connected - Ready to chat');
    }, 2000);
}

// AI Mode Modal Management
function openCreateModeModal() {
    const modal = document.getElementById('createModeModal');
    
    // Reset form fields
    document.getElementById('createModeName').value = '';
    document.getElementById('createModeDescription').value = '';
    document.getElementById('createModeAiName').value = 'Silma AI';
    document.getElementById('createModeSystemMessage').value = '';
    document.getElementById('createModeIcon').value = 'psychology';
    document.getElementById('createModeDepartment').value = '';
    document.getElementById('createModeTemperature').value = '0.7';
    document.getElementById('createModeMaxTokens').value = '4096';
    document.getElementById('createModeTopP').value = '0.8';
    document.getElementById('createModeTopK').value = '40';
    document.getElementById('createModeActive').checked = true;
    
    // Update display values
    document.getElementById('createModeTempValue').textContent = '0.7';
    document.getElementById('createModeTokenValue').textContent = '4096';
    document.getElementById('createModeTopPValue').textContent = '0.8';
    document.getElementById('createModeTopKValue').textContent = '40';
    
    modal.classList.add('show');
    document.getElementById('createModeName').focus();
}

function closeCreateModeModal() {
    const modal = document.getElementById('createModeModal');
    modal.classList.remove('show');
}

function openEditModeModal(mode) {
    const modal = document.getElementById('editModeModal');
    
    // Populate form fields with mode data
    document.getElementById('editModeId').value = mode.id;
    document.getElementById('editModeName').value = mode.name;
    document.getElementById('editModeDescription').value = mode.description || '';
    document.getElementById('editModeAiName').value = mode.aiName;
    document.getElementById('editModeSystemMessage').value = mode.systemPrompt || '';
    document.getElementById('editModeIcon').value = mode.icon || 'psychology';
    document.getElementById('editModeDepartment').value = mode.department || '';
    document.getElementById('editModeTemperature').value = mode.temperature;
    document.getElementById('editModeMaxTokens').value = mode.maxTokens;
    document.getElementById('editModeTopP').value = mode.topP;
    document.getElementById('editModeTopK').value = mode.topK;
    document.getElementById('editModeActive').checked = mode.is_active;
    
    // Update display values
    document.getElementById('editModeTempValue').textContent = mode.temperature;
    document.getElementById('editModeTokenValue').textContent = mode.maxTokens;
    document.getElementById('editModeTopPValue').textContent = mode.topP;
    document.getElementById('editModeTopKValue').textContent = mode.topK;
    
    modal.classList.add('show');
    document.getElementById('editModeName').focus();
}

function closeEditModeModal() {
    const modal = document.getElementById('editModeModal');
    modal.classList.remove('show');
}

async function saveCreateMode() {
    try {
        const modeData = {
            name: document.getElementById('createModeName').value.trim(),
            description: document.getElementById('createModeDescription').value.trim(),
            aiName: document.getElementById('createModeAiName').value.trim(),
            systemPrompt: document.getElementById('createModeSystemMessage').value.trim(),
            icon: document.getElementById('createModeIcon').value,
            department: document.getElementById('createModeDepartment').value.trim(),
            temperature: parseFloat(document.getElementById('createModeTemperature').value),
            maxTokens: parseInt(document.getElementById('createModeMaxTokens').value),
            topP: parseFloat(document.getElementById('createModeTopP').value),
            topK: parseInt(document.getElementById('createModeTopK').value),
            is_active: document.getElementById('createModeActive').checked
        };
        
        if (!modeData.name) {
            alert('Mode name is required');
            return;
        }
        
        await createAiMode(modeData);
        closeCreateModeModal();
        updateStatus('connected', 'AI mode created successfully');
        
        setTimeout(() => {
            updateStatus('connected', 'Connected - Ready to chat');
        }, 2000);
        
    } catch (error) {
        console.error('Error creating mode:', error);
        alert('Error creating mode: ' + error.message);
    }
}

async function saveEditMode() {
    try {
        const modeId = document.getElementById('editModeId').value;
        const modeData = {
            name: document.getElementById('editModeName').value.trim(),
            description: document.getElementById('editModeDescription').value.trim(),
            aiName: document.getElementById('editModeAiName').value.trim(),
            systemPrompt: document.getElementById('editModeSystemMessage').value.trim(),
            icon: document.getElementById('editModeIcon').value,
            department: document.getElementById('editModeDepartment').value.trim(),
            temperature: parseFloat(document.getElementById('editModeTemperature').value),
            maxTokens: parseInt(document.getElementById('editModeMaxTokens').value),
            topP: parseFloat(document.getElementById('editModeTopP').value),
            topK: parseInt(document.getElementById('editModeTopK').value),
            is_active: document.getElementById('editModeActive').checked
        };
        
        if (!modeData.name) {
            alert('Mode name is required');
            return;
        }
        
        await updateAiMode(modeId, modeData);
        closeEditModeModal();
        updateStatus('connected', 'AI mode updated successfully');
        
        setTimeout(() => {
            updateStatus('connected', 'Connected - Ready to chat');
        }, 2000);
        
    } catch (error) {
        console.error('Error updating mode:', error);
        alert('Error updating mode: ' + error.message);
    }
}

async function toggleModeActive(modeId) {
    try {
        await toggleAiModeActive(modeId);
        updateStatus('connected', 'AI mode status toggled');
        
        setTimeout(() => {
            updateStatus('connected', 'Connected - Ready to chat');
        }, 2000);
        
    } catch (error) {
        console.error('Error toggling mode:', error);
        alert('Error toggling mode: ' + error.message);
    }
}

async function deleteMode(modeId) {
    if (!confirm('Are you sure you want to delete this AI mode? This action cannot be undone.')) {
        return;
    }
    
    try {
        await deleteAiMode(modeId);
        updateStatus('connected', 'AI mode deleted successfully');
        
        setTimeout(() => {
            updateStatus('connected', 'Connected - Ready to chat');
        }, 2000);
        
    } catch (error) {
        console.error('Error deleting mode:', error);
        alert('Error deleting mode: ' + error.message);
    }
}

// Toggle between showing all modes and active modes only
async function toggleModesView() {
    showAllModes = !showAllModes;
    
    // Update the toggle button text
    const toggleButton = document.getElementById('toggleModesView');
    if (toggleButton) {
        toggleButton.textContent = showAllModes ? 'Show Active Only' : 'Show All';
        toggleButton.title = showAllModes ? 'Show only active AI modes' : 'Show all AI modes (including inactive)';
    }
    
    // Reload modes with the new view
    await loadModes();
    
    // Update status
    const statusText = showAllModes ? 'Showing all modes' : 'Showing active modes only';
    updateStatus('connected', statusText);
    
    setTimeout(() => {
        updateStatus('connected', 'Connected - Ready to chat');
    }, 2000);
}

// Mode Management
async function loadModes() {
    try {
        // Choose endpoint based on current view
        const endpoint = showAllModes ? '/api/ai-modes' : '/api/ai-modes/active';
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to load modes');
        }
        
        // Transform API data to match expected format
        modes = result.data.map(mode => ({
            id: mode.id,
            name: mode.name,
            aiName: mode.ai_name,
            systemPrompt: mode.system_message,
            temperature: parseFloat(mode.temperature),
            maxTokens: mode.max_tokens,
            topP: parseFloat(mode.top_p),
            topK: mode.top_k,
            icon: mode.icon,
            department: mode.department,
            is_active: mode.is_active,
            description: mode.description
        }));
        
        filteredModes = [...modes]; // Initialize filtered modes with all modes
        
        // Render the modes list
        renderModesList();
        
        // Select first mode if available
        if (modes.length > 0) {
            selectMode(modes[0]);
        }
        
    } catch (error) {
        console.error('Error loading modes:', error);
        updateStatus('disconnected', 'Error loading modes');
    }
}

function selectMode(mode) {
    if (!mode) return;
    
    currentMode = mode;
    
    // Clear search when a mode is selected
    clearModesSearch();
    
    // Update UI - highlight the selected mode
    const modeItems = document.querySelectorAll('.mode-item');
    modeItems.forEach((item) => {
        item.classList.remove('active');
        // Check if this item corresponds to the selected mode
        const modeName = item.querySelector('.mode-name')?.textContent;
        if (modeName === mode.name) {
            item.classList.add('active');
        }
    });
    
    // Apply mode settings
    aiName = mode.aiName;
    systemMessage = mode.systemPrompt;
    temperature = mode.temperature;
    maxTokens = mode.maxTokens;
    topP = mode.topP;
    topK = mode.topK;
    
    // Update initial message header
    const initialHeader = document.getElementById('initialAiHeader');
    if (initialHeader) {
        initialHeader.textContent = aiName;
    }
    
    // Show mode change message without clearing conversation
    addMessage('assistant', `Mode switched to "${mode.name}". I'm now ${aiName} and ready to help you!`);
    
    updateStatus('connected', `Mode: ${mode.name} - ${aiName}`);
}

// AI Mode Management Functions
async function createAiMode(modeData) {
    try {
        const response = await fetch('/api/ai-modes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: modeData.name,
                description: modeData.description,
                ai_name: modeData.aiName,
                system_message: modeData.systemPrompt,
                temperature: modeData.temperature,
                max_tokens: modeData.maxTokens,
                top_p: modeData.topP,
                top_k: modeData.topK,
                icon: modeData.icon,
                department: modeData.department,
                is_active: modeData.is_active
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to create AI mode');
        }

        // Reload modes to get the updated list
        await loadModes();
        return result.data;
    } catch (error) {
        console.error('Error creating AI mode:', error);
        throw error;
    }
}

async function updateAiMode(modeId, modeData) {
    try {
        const response = await fetch(`/api/ai-modes/${modeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: modeData.name,
                description: modeData.description,
                ai_name: modeData.aiName,
                system_message: modeData.systemPrompt,
                temperature: modeData.temperature,
                max_tokens: modeData.maxTokens,
                top_p: modeData.topP,
                top_k: modeData.topK,
                icon: modeData.icon,
                department: modeData.department,
                is_active: modeData.is_active
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to update AI mode');
        }

        // Reload modes to get the updated list
        await loadModes();
        return result.data;
    } catch (error) {
        console.error('Error updating AI mode:', error);
        throw error;
    }
}

async function deleteAiMode(modeId) {
    try {
        const response = await fetch(`/api/ai-modes/${modeId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete AI mode');
        }

        // Reload modes to get the updated list
        await loadModes();
        return result.data;
    } catch (error) {
        console.error('Error deleting AI mode:', error);
        throw error;
    }
}

async function toggleAiModeActive(modeId) {
    try {
        const response = await fetch('/api/ai-modes/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: modeId })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to toggle AI mode');
        }

        // Reload modes to get the updated list
        await loadModes();
        return result.data;
    } catch (error) {
        console.error('Error toggling AI mode:', error);
        throw error;
    }
}

// File Management
function setupFileHandlers() {
    const fileDropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('fileInput');

    // File input change handler
    fileInput.addEventListener('change', function(e) {
        handleFiles(Array.from(e.target.files));
        e.target.value = ''; // Reset input
    });

    // Drag and drop handlers
    fileDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        fileDropZone.classList.add('drag-over');
    });

    fileDropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        if (!fileDropZone.contains(e.relatedTarget)) {
            fileDropZone.classList.remove('drag-over');
        }
    });

    fileDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        fileDropZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    });

    // Click handler for file selection
    fileDropZone.addEventListener('click', function(e) {
        if (e.target === fileDropZone || e.target.closest('.file-drop-content')) {
            fileInput.click();
        }
    });
}

function handleFiles(files) {
    for (const file of files) {
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            updateStatus('disconnected', `File "${file.name}" is too large. Maximum size is 50MB.`);
            continue;
        }

        const fileObj = {
            id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            file: file,
            name: file.name,
            size: file.size,
            type: file.type,
            uploaded: false
        };

        attachedFiles.push(fileObj);
        displayAttachedFile(fileObj);
    }

    updateFileDropZoneVisibility();
}

function displayAttachedFile(fileObj) {
    const attachedFilesContainer = document.getElementById('attachedFiles');
    
    const fileElement = document.createElement('div');
    fileElement.className = 'attached-file';
    fileElement.id = `attached-${fileObj.id}`;
    
    const icon = getFileIcon(fileObj.type);
    const sizeStr = formatFileSize(fileObj.size);
    
    fileElement.innerHTML = `
        <span class="material-icons attached-file-icon">${icon}</span>
        <span class="attached-file-name" title="${fileObj.name}">${fileObj.name}</span>
        <span class="attached-file-size">${sizeStr}</span>
        <button class="attached-file-remove" onclick="removeAttachedFile('${fileObj.id}')" title="Remove file">
            <span class="material-icons">close</span>
        </button>
    `;
    
    attachedFilesContainer.appendChild(fileElement);
}

function removeAttachedFile(fileId) {
    attachedFiles = attachedFiles.filter(f => f.id !== fileId);
    const fileElement = document.getElementById(`attached-${fileId}`);
    if (fileElement) {
        fileElement.remove();
    }
    updateFileDropZoneVisibility();
}

function updateFileDropZoneVisibility() {
    const fileDropZone = document.getElementById('fileDropZone');
    const attachedFilesContainer = document.getElementById('attachedFiles');
    
    if (attachedFiles.length > 0) {
        fileDropZone.style.display = 'none';
        attachedFilesContainer.style.display = 'flex';
    } else {
        fileDropZone.style.display = 'block';
        attachedFilesContainer.style.display = 'none';
    }
}

function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'videocam';
    if (mimeType.startsWith('audio/')) return 'audiotrack';
    if (mimeType === 'application/pdf') return 'picture_as_pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'table_chart';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'slideshow';
    if (mimeType === 'text/plain') return 'text_snippet';
    if (mimeType === 'application/json') return 'code';
    return 'attach_file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function uploadFiles() {
    const filesToUpload = attachedFiles.filter(f => !f.uploaded);
    if (filesToUpload.length === 0) return [];

    const uploadedFiles = [];
    
    for (const fileObj of filesToUpload) {
        try {
            const formData = new FormData();
            formData.append('file', fileObj.file);
            formData.append('fileId', fileObj.id);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                fileObj.uploaded = true;
                fileObj.serverPath = result.path;
                uploadedFiles.push({
                    id: fileObj.id,
                    name: fileObj.name,
                    type: fileObj.type,
                    size: fileObj.size,
                    path: result.path
                });
            } else {
                updateStatus('disconnected', `Failed to upload ${fileObj.name}`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            updateStatus('disconnected', `Error uploading ${fileObj.name}`);
        }
    }

    return uploadedFiles;
}

// Event Listeners
function setupEventListeners() {
    setupFileHandlers();
    
    // Handle Enter key in textarea
    document.getElementById('prompt').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendPrompt();
        }
    });

    // Handle modes search input
    const modesSearchInput = document.getElementById('modesSearch');
    if (modesSearchInput) {
        modesSearchInput.addEventListener('input', function(e) {
            searchModes(e.target.value);
        });
    }

    // Close modal when clicking outside
    document.getElementById('settingsModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeSettingsModal();
        }
    });

    // Close all menus when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.message-actions')) {
            document.querySelectorAll('.message-actions-menu').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });

    // Add event listeners for modal sliders
    document.getElementById('modalTemperature').addEventListener('input', function() {
        document.getElementById('modalTempValue').textContent = this.value;
    });

    document.getElementById('modalMaxTokens').addEventListener('input', function() {
        document.getElementById('modalTokenValue').textContent = this.value;
    });

    document.getElementById('modalTopP').addEventListener('input', function() {
        document.getElementById('modalTopPValue').textContent = this.value;
    });

    document.getElementById('modalTopK').addEventListener('input', function() {
        document.getElementById('modalTopKValue').textContent = this.value;
    });
}

// Strategy Management
async function loadStrategies() {
    try {
        // Load sequences from the database API
        const response = await fetch('/api/recordings');
        if (!response.ok) {
            throw new Error(`Failed to fetch sequences: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load sequences');
        }
        
        const allStrategies = [];
        
        // Convert database recordings to strategy format
        result.data.forEach(recording => {
            allStrategies.push({
                key: recording.id, // Use the database ID as the key
                name: recording.name,
                description: recording.description || 'No description available',
                department: 'Recorded Sequences', // Group all recorded sequences together
                departmentKey: 'recorded-sequences',
                sequence: recording.sequence, // Store the actual sequence data
                created_at: recording.created_at,
                updated_at: recording.updated_at
            });
        });
        
        strategies = allStrategies;
        filteredStrategies = [...allStrategies];
        populateStrategyList(allStrategies);
        
        console.log(`Loaded ${allStrategies.length} recorded sequences from database`);
    } catch (error) {
        console.error('Error loading strategies:', error);
        updateStatus('disconnected', 'Failed to load sequences: ' + error.message);
    }
}

function populateStrategyList(strategies) {
    const strategyList = document.getElementById('strategyList');
    if (!strategyList) return;
    
    strategyList.innerHTML = '';
    
    // Group strategies by department
    const departments = {};
    strategies.forEach(strategy => {
        if (!departments[strategy.department]) {
            departments[strategy.department] = [];
        }
        departments[strategy.department].push(strategy);
    });
    
    // Create strategy items grouped by department
    Object.keys(departments).sort().forEach(department => {
        // Add department header
        const departmentHeader = document.createElement('div');
        departmentHeader.className = 'strategy-department-header';
        departmentHeader.innerHTML = `
            <h4>${department}</h4>
        `;
        strategyList.appendChild(departmentHeader);
        
        // Add strategies for this department
        departments[department].forEach(strategy => {
            const strategyItem = document.createElement('div');
            strategyItem.className = 'strategy-item';
            strategyItem.setAttribute('data-strategy-key', strategy.key);
            strategyItem.setAttribute('data-department-key', strategy.departmentKey);
            
            // Format the creation date
            const createdDate = strategy.created_at ? new Date(strategy.created_at).toLocaleDateString() : 'Unknown';
            
            strategyItem.innerHTML = `
                <div class="strategy-header">
                    <span class="material-icons strategy-icon">play_arrow</span>
                    <div class="strategy-info">
                        <div class="strategy-name">${strategy.name}</div>
                        <div class="strategy-description">${strategy.description || 'No description available'}</div>
                        <div class="strategy-meta">Created: ${createdDate}</div>
                    </div>
                    <button class="strategy-delete-btn" onclick="deleteSequence('${strategy.key}')" title="Delete sequence">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            `;
            
            strategyItem.addEventListener('click', async (event) => {
                // Prevent event bubbling if clicking on delete button
                if (event.target.closest('.strategy-delete-btn')) {
                    return;
                }
                
                // Remove active class from all strategy items
                document.querySelectorAll('.strategy-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // Add active class to clicked item
                strategyItem.classList.add('active');
                
                // Execute the strategy immediately
                await executeStrategy(strategy.key, strategy.departmentKey);
            });
            
            strategyList.appendChild(strategyItem);
        });
    });
}

// Strategy Search Functions
function setupStrategySearch() {
    const searchInput = document.getElementById('strategySearch');
    const clearButton = document.getElementById('strategySearchClear');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            
            if (searchTerm) {
                clearButton.style.display = 'block';
                filterStrategies(searchTerm);
            } else {
                clearButton.style.display = 'none';
                clearStrategySearch();
            }
        });
    }
}

function filterStrategies(searchTerm) {
    filteredStrategies = strategies.filter(strategy => 
        strategy.name.toLowerCase().includes(searchTerm) ||
        strategy.description.toLowerCase().includes(searchTerm) ||
        strategy.department.toLowerCase().includes(searchTerm)
    );
    
    populateStrategyList(filteredStrategies);
}

function clearStrategySearch() {
    const searchInput = document.getElementById('strategySearch');
    const clearButton = document.getElementById('strategySearchClear');
    
    if (searchInput) {
        searchInput.value = '';
    }
    if (clearButton) {
        clearButton.style.display = 'none';
    }
    
    filteredStrategies = [...strategies];
    populateStrategyList(filteredStrategies);
}

function selectStrategy() {
    const dropdown = document.getElementById('strategyDropdown');
    const embeddedDropdown = document.getElementById('embeddedStrategyDropdown');
    
    // Check both dropdowns
    const selectedKey = (dropdown && dropdown.value) || (embeddedDropdown && embeddedDropdown.value);
    
    if (selectedKey) {
        console.log('Selected strategy key:', selectedKey);
        
        // Find the strategy details to get the department key
        const selectedOption = (dropdown && dropdown.selectedOptions[0]) || (embeddedDropdown && embeddedDropdown.selectedOptions[0]);
        if (selectedOption) {
            const optgroup = selectedOption.parentElement;
            const departmentName = optgroup.label;
            
            // Map department name to department key
            const departmentKeyMap = {
                'Analytics': 'analytics',
                'Branding': 'branding',
                'Conversational': 'conversational',
                'Customer Support': 'customer-support',
                'Design': 'design',
                'Finance': 'finance',
                'Human Resources': 'human-resources',
                'Legal': 'legal',
                'Marketing': 'marketing',
                'Product': 'product',
                'Quality Assurance': 'quality-assurance',
                'Research': 'research',
                'Sales': 'sales',
                'Scrum': 'scrum',
                'Strategic Planning': 'strategic-planning'
            };
            
            const departmentKey = departmentKeyMap[departmentName];
            
            if (departmentKey) {
                // Execute the selected strategy
                executeStrategy(selectedKey, departmentKey);
            } else {
                console.error('Unknown department:', departmentName);
                updateStatus('disconnected', 'Unknown department: ' + departmentName);
            }
        }
        
        // Reset dropdowns to default
        if (dropdown) dropdown.value = '';
        if (embeddedDropdown) embeddedDropdown.value = '';
        // Close the actions dropdown
        closeActionsDropdown();
    }
}

async function executeStrategy(strategyKey, departmentKey) {
    try {
        console.log(`Executing sequence: ${strategyKey}`);
        
        // Find the strategy/sequence data
        const strategy = strategies.find(s => s.key === strategyKey);
        if (!strategy) {
            throw new Error('Sequence not found');
        }
        
        // Execute the sequence directly using the plan executor
        const response = await fetch('/api/plan/execute-sequence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sequence: strategy.sequence,
                speed: 1.0
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Sequence execution started successfully');
        } else {
            console.error('Failed to execute sequence:', result.error);
        }
    } catch (error) {
        console.error('Error executing sequence:', error);
    }
}

// Executing indicator function removed - no longer needed

// Execution status tracking removed

// Polling function removed - no longer needed

// Execution status functions removed - no longer needed

function toggleActionsDropdown() {
    const dropdown = document.getElementById('actionsDropdown');
    if (!dropdown) return;
    
    if (dropdown.classList.contains('show')) {
        closeActionsDropdown();
    } else {
        openActionsDropdown();
    }
}

function openActionsDropdown() {
    const dropdown = document.getElementById('actionsDropdown');
    if (!dropdown) return;
    
    // Close any other open dropdowns first
    closeActionsDropdown();
    
    dropdown.classList.add('show');
    
    // Add click outside listener
    setTimeout(() => {
        document.addEventListener('click', closeActionsDropdownOnClickOutside);
    }, 0);
}

function closeActionsDropdown() {
    const dropdown = document.getElementById('actionsDropdown');
    if (!dropdown) return;
    
    dropdown.classList.remove('show');
    document.removeEventListener('click', closeActionsDropdownOnClickOutside);
}

function closeActionsDropdownOnClickOutside(event) {
    const dropdown = document.getElementById('actionsDropdown');
    const button = document.querySelector('.actions-dropdown-button');
    
    if (dropdown && !dropdown.contains(event.target) && !button?.contains(event.target)) {
        closeActionsDropdown();
    }
}

// Initialize application
function initializeApp() {
    setupEventListeners();
    loadModes();
    loadStrategies();
    setupStrategySearch();
    
    // Set initial timestamp
    const initialTimestamp = document.getElementById('initialTimestamp');
    if (initialTimestamp) {
        initialTimestamp.textContent = new Date().toLocaleTimeString();
    }
    
    updateStatus('connected', 'Connected - Ready to chat');
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
