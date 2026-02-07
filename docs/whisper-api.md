  ---                                                                                                                                                 
WhisperLive API Documentation

Service Overview                                                                                                                                    
┌──────┬───────────┬───────────────────────────────────┐                                                                                            
│ Port │ Protocol  │            Description            │                                                                                            
├──────┼───────────┼───────────────────────────────────┤                                                                                            
│ 9090 │ WebSocket │ Real-time streaming transcription │                                                                                            
├──────┼───────────┼───────────────────────────────────┤                                                                                            
│ 8001 │ HTTP      │ OpenAI-compatible REST API        │                                                                                            
└──────┴───────────┴───────────────────────────────────┘
  ---                                                                                                                                                 
WebSocket Streaming API (Port 9090)

Connection

ws://local.devbox.imgplex.io:9090

Audio Format Requirements                                                                                                                           
┌─────────────┬────────────────────┐                                                                                                                
│  Property   │       Value        │                                                                                                                
├─────────────┼────────────────────┤                                                                                                                
│ Sample Rate │ 16,000 Hz (16 kHz) │                                                                                                                
├─────────────┼────────────────────┤                                                                                                                
│ Bit Depth   │ 16-bit signed PCM  │                                                                                                                
├─────────────┼────────────────────┤                                                                                                                
│ Channels    │ Mono (1 channel)   │                                                                                                                
├─────────────┼────────────────────┤                                                                                                                
│ Format      │ Binary frames      │                                                                                                                
└─────────────┴────────────────────┘                                                                                                                
Protocol Flow

1. Connect and send configuration:                                                                                                                  
   {                                                                                                                                                   
   "uid": "unique-client-id",                                                                                                                        
   "language": "en",                                                                                                                                 
   "task": "transcribe",                                                                                                                             
   "model": "large-v3",                                                                                                                              
   "use_vad": true                                                                                                                                   
   }

2. Server responds with ready signal:                                                                                                               
   {                                                                                                                                                   
   "uid": "unique-client-id",                                                                                                                        
   "message": "SERVER_READY",                                                                                                                        
   "backend": "faster_whisper"                                                                                                                       
   }

3. Stream audio as binary frames

4. Receive transcription segments:                                                                                                                  
   {                                                                                                                                                   
   "uid": "unique-client-id",                                                                                                                        
   "segments": [                                                                                                                                     
   {                                                                                                                                               
   "text": "Hello world",                                                                                                                        
   "start": 0.0,                                                                                                                                 
   "end": 1.5,                                                                                                                                   
   "completed": true                                                                                                                             
   }                                                                                                                                               
   ],                                                                                                                                                
   "language": "en",                                                                                                                                 
   "language_prob": 0.98                                                                                                                             
   }

5. End session:                                                                                                                                     
   Send END_OF_AUDIO as UTF-8 bytes in binary frame.

Configuration Options                                                                                                                               
┌──────────────────────┬─────────┬────────────────────────────────────────┐                                                                         
│      Parameter       │  Type   │              Description               │                                                                         
├──────────────────────┼─────────┼────────────────────────────────────────┤                                                                         
│ uid                  │ string  │ Unique client identifier               │                                                                         
├──────────────────────┼─────────┼────────────────────────────────────────┤                                                                         
│ language             │ string  │ Language code (e.g., "en", "es", "fr") │                                                                         
├──────────────────────┼─────────┼────────────────────────────────────────┤                                                                         
│ task                 │ string  │ "transcribe" or "translate"            │                                                                         
├──────────────────────┼─────────┼────────────────────────────────────────┤                                                                         
│ model                │ string  │ Model name                             │                                                                         
├──────────────────────┼─────────┼────────────────────────────────────────┤                                                                         
│ use_vad              │ boolean │ Enable voice activity detection        │                                                                         
├──────────────────────┼─────────┼────────────────────────────────────────┤                                                                         
│ send_last_n_segments │ integer │ Number of recent segments to return    │                                                                         
├──────────────────────┼─────────┼────────────────────────────────────────┤                                                                         
│ no_speech_thresh     │ float   │ Silence detection threshold            │                                                                         
├──────────────────────┼─────────┼────────────────────────────────────────┤                                                                         
│ enable_translation   │ boolean │ Enable translation output              │                                                                         
├──────────────────────┼─────────┼────────────────────────────────────────┤                                                                         
│ target_language      │ string  │ Translation target language            │                                                                         
└──────────────────────┴─────────┴────────────────────────────────────────┘                                                                         
Server Messages

Status messages:                                                                                                                                    
{                                                                                                                                                   
"uid": "client-id",                                                                                                                               
"status": "WAIT",                                                                                                                                 
"message": "Server is busy, please wait..."                                                                                                       
}

Language detection:                                                                                                                                 
{                                                                                                                                                   
"uid": "client-id",                                                                                                                               
"language": "en",                                                                                                                                 
"language_prob": 0.95                                                                                                                             
}
                                                                                                                                                      
---                                                                                                                                                 
REST API (Port 8001)

POST /v1/audio/transcriptions

OpenAI-compatible transcription endpoint.

Request:                                                                                                                                            
curl -X POST http://local.devbox.imgplex.io:8001/v1/audio/transcriptions \                                                                                        
-F file=@audio.wav \                                                                                                                              
-F model=whisper-1 \                                                                                                                              
-F language=en \                                                                                                                                  
-F response_format=json

Parameters:                                                                                                                                         
┌─────────────────────────┬────────┬───────────┬───────────────────────────────────────────────────┐                                                
│        Parameter        │  Type  │  Default  │                    Description                    │                                                
├─────────────────────────┼────────┼───────────┼───────────────────────────────────────────────────┤                                                
│ file                    │ file   │ required  │ Audio file (wav, mp3, etc.)                       │                                                
├─────────────────────────┼────────┼───────────┼───────────────────────────────────────────────────┤                                                
│ model                   │ string │ whisper-1 │ Model identifier (ignored, uses configured model) │                                                
├─────────────────────────┼────────┼───────────┼───────────────────────────────────────────────────┤                                                
│ language                │ string │ auto      │ Language code for transcription                   │                                                
├─────────────────────────┼────────┼───────────┼───────────────────────────────────────────────────┤                                                
│ prompt                  │ string │ none      │ Initial prompt for context                        │                                                
├─────────────────────────┼────────┼───────────┼───────────────────────────────────────────────────┤                                                
│ response_format         │ string │ json      │ Output format                                     │                                                
├─────────────────────────┼────────┼───────────┼───────────────────────────────────────────────────┤                                                
│ temperature             │ float  │ 0.0       │ Sampling temperature                              │                                                
├─────────────────────────┼────────┼───────────┼───────────────────────────────────────────────────┤                                                
│ timestamp_granularities │ list   │ none      │ Timestamp detail level                            │                                                
└─────────────────────────┴────────┴───────────┴───────────────────────────────────────────────────┘                                                
Response Formats:

json (default):                                                                                                                                     
{                                                                                                                                                   
"text": "The transcribed text content."                                                                                                           
}

verbose_json:                                                                                                                                       
{                                                                                                                                                   
"task": "transcribe",                                                                                                                             
"language": "en",                                                                                                                                 
"duration": 5.5,                                                                                                                                  
"text": "The transcribed text content.",                                                                                                          
"segments": [                                                                                                                                     
{                                                                                                                                               
"id": 0,                                                                                                                                      
"start": 0.0,                                                                                                                                 
"end": 2.5,                                                                                                                                   
"text": "The transcribed",                                                                                                                    
"tokens": [1, 2, 3],                                                                                                                          
"temperature": 0.0,                                                                                                                           
"avg_logprob": -0.25,                                                                                                                         
"compression_ratio": 1.2,                                                                                                                     
"no_speech_prob": 0.01                                                                                                                        
}                                                                                                                                               
]                                                                                                                                                 
}

text:                                                                                                                                               
The transcribed text content.

srt:                                                                                                                                                
1                                                                                                                                                   
00:00:00,000 --> 00:00:02,500                                                                                                                       
The transcribed text content.

vtt:                                                                                                                                                
WEBVTT

00:00:00.000 --> 00:00:02.500                                                                                                                       
The transcribed text content.
                                                                                                                                                      
---                                                                                                                                                 
Python Client Example

from whisper_live.client import TranscriptionClient

client = TranscriptionClient(                                                                                                                       
host="local.devbox.imgplex.io",                                                                                                                               
port=9090,                                                                                                                                      
lang="en",                                                                                                                                      
translate=False,                                                                                                                                
model="large-v3",                                                                                                                               
use_vad=True,                                                                                                                                   
save_output_recording=True,                                                                                                                     
output_recording_filename="./recording.wav"                                                                                                     
)

# Transcribe audio file
client("audio.wav")

# Transcribe from microphone
client()

# Transcribe RTSP stream
client(rtsp_url="rtsp://user:pass@192.168.1.100/stream")

# Transcribe HLS stream
client(hls_url="http://example.com/stream.m3u8")
                                                                                                                                                      
---                                                                                                                                                 
JavaScript WebSocket Example

const ws = new WebSocket('ws://local.devbox.imgplex.io:9090');

ws.onopen = () => {                                                                                                                                 
// Send configuration                                                                                                                             
ws.send(JSON.stringify({                                                                                                                          
uid: crypto.randomUUID(),                                                                                                                       
language: 'en',                                                                                                                                 
task: 'transcribe',                                                                                                                             
use_vad: true                                                                                                                                   
}));                                                                                                                                              
};

ws.onmessage = (event) => {                                                                                                                         
const data = JSON.parse(event.data);

    if (data.message === 'SERVER_READY') {                                                                                                            
      console.log('Ready to stream audio');                                                                                                           
      startAudioStream();                                                                                                                             
    }                                                                                                                                                 
                                                                                                                                                      
    if (data.segments) {                                                                                                                              
      data.segments.forEach(seg => {                                                                                                                  
        console.log(`[${seg.start.toFixed(2)}s] ${seg.text}`);                                                                                        
      });                                                                                                                                             
    }                                                                                                                                                 
};

async function startAudioStream() {                                                                                                                 
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });                                                                        
const audioContext = new AudioContext({ sampleRate: 16000 });                                                                                     
const source = audioContext.createMediaStreamSource(stream);                                                                                      
const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {                                                                                                               
      const float32 = e.inputBuffer.getChannelData(0);                                                                                                
      const int16 = new Int16Array(float32.length);                                                                                                   
      for (let i = 0; i < float32.length; i++) {                                                                                                      
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));                                                                             
      }                                                                                                                                               
      ws.send(int16.buffer);                                                                                                                          
    };                                                                                                                                                
                                                                                                                                                      
    source.connect(processor);                                                                                                                        
    processor.connect(audioContext.destination);                                                                                                      
}

// End session                                                                                                                                      
function endSession() {                                                                                                                             
ws.send(new TextEncoder().encode('END_OF_AUDIO'));                                                                                                
ws.close();                                                                                                                                       
}
                                                                                                                                                      
---                                                                                                                                                 
Model Options

Configure via WHISPER_MODEL environment variable:                                                                                                   
┌──────────┬─────────────────────────────────┬──────┬─────────┬─────────┐                                                                           
│  Model   │        HuggingFace Path         │ Size │  Speed  │ Quality │                                                                           
├──────────┼─────────────────────────────────┼──────┼─────────┼─────────┤                                                                           
│ tiny     │ Systran/faster-whisper-tiny     │ 39M  │ Fastest │ Low     │                                                                           
├──────────┼─────────────────────────────────┼──────┼─────────┼─────────┤                                                                           
│ base     │ Systran/faster-whisper-base     │ 74M  │ Fast    │ Fair    │                                                                           
├──────────┼─────────────────────────────────┼──────┼─────────┼─────────┤                                                                           
│ small    │ Systran/faster-whisper-small    │ 244M │ Medium  │ Good    │                                                                           
├──────────┼─────────────────────────────────┼──────┼─────────┼─────────┤                                                                           
│ medium   │ Systran/faster-whisper-medium   │ 769M │ Slow    │ Better  │                                                                           
├──────────┼─────────────────────────────────┼──────┼─────────┼─────────┤                                                                           
│ large-v3 │ Systran/faster-whisper-large-v3 │ 1.5G │ Slowest │ Best    │                                                                           
└──────────┴─────────────────────────────────┴──────┴─────────┴─────────┘                                                                           
WHISPER_MODEL=Systran/faster-whisper-small docker compose up -d whisper
                                                                                                                                                      
---                                                                                                                                                 
Language Codes

Common codes: en, es, fr, de, it, pt, nl, pl, ru, zh, ja, ko, ar, hi

Leave empty for auto-detection.   