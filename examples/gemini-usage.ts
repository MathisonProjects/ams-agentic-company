import GeminiAiPlugin from '../src/plugins/gemini.ai';
import { readFileSync } from 'fs';
import { join } from 'path';

async function demonstrateGeminiUsage() {
  try {
    // Initialize the Gemini AI plugin
    const gemini = new GeminiAiPlugin();
    
    console.log('🤖 Gemini AI Plugin Demo');
    console.log('========================\n');

    // 1. Validate API key
    console.log('1. Validating API key...');
    const isValid = await gemini.validateApiKey();
    console.log(`✅ API Key valid: ${isValid}\n`);

    if (!isValid) {
      console.log('❌ Invalid API key. Please check your GEMINI_API_KEY environment variable.');
      return;
    }

    // 2. Text-only conversation
    console.log('2. Text-only conversation...');
    const textMessages = [
      {
        role: 'user' as const,
        parts: [{ text: 'Hello! Can you tell me a short joke?' }]
      }
    ];

    const textResponse = await gemini.processText(textMessages);
    console.log(`🤖 Response: ${textResponse.text}\n`);

    // 3. Text with images (example with base64 image)
    console.log('3. Text with images...');
    const sampleImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

    const imageResponse = await gemini.processTextWithImages(
      'What do you see in this image?',
      [{ data: sampleImageBase64, mimeType: 'image/jpeg' }]
    );
    console.log(`🖼️ Image Response: ${imageResponse.text}\n`);

    // 4. Streaming text response
    console.log('4. Streaming text response...');
    const streamMessages = [
      {
        role: 'user' as const,
        parts: [{ text: 'Write a short story about a robot learning to paint.' }]
      }
    ];

    console.log('📝 Streaming response:');
    for await (const chunk of gemini.streamText(streamMessages)) {
      if (chunk.text) {
        process.stdout.write(chunk.text);
      }
      if (chunk.isComplete) {
        console.log('\n✅ Stream completed\n');
      }
    }

    // 5. Text with custom options
    console.log('5. Text with custom options (low temperature for more focused response)...');
    const customResponse = await gemini.processText(
      [{ role: 'user', parts: [{ text: 'Explain quantum computing in one sentence.' }] }],
      { temperature: 0.1, maxTokens: 100 }
    );
    console.log(`🎯 Focused Response: ${customResponse.text}\n`);

    console.log('🎉 Demo completed successfully!');

  } catch (error) {
    console.error('❌ Error during demo:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateGeminiUsage();
}

export { demonstrateGeminiUsage };
