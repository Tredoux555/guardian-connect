import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../services/api'
import { getCurrentUserId, getCurrentUserEmail } from '../utils/jwt'
import { 
  connectSocket, 
  joinEmergency, 
  onNewMessage, 
  removeMessageListener,
  getSocket
} from '../services/socket'
import './EmergencyChat.css'

interface Message {
  id: string
  emergency_id: string
  user_id: string
  user_email: string
  user_display_name?: string
  message: string | null
  image_url: string | null
  audio_url: string | null
  video_url: string | null
  created_at: string
}

interface EmergencyChatProps {
  emergencyId: string
}

export const EmergencyChat = ({ emergencyId }: EmergencyChatProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [messageText, setMessageText] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const videoRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const videoChunksRef = useRef<Blob[]>([])
  const audioTimerRef = useRef<number | null>(null)
  const videoTimerRef = useRef<number | null>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)
  const currentUserId = getCurrentUserId()

  // Load messages on mount
  useEffect(() => {
    loadMessages()
  }, [emergencyId])

  // Ensure socket connection and join emergency room for real-time messages
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token && emergencyId) {
      console.log('🔌 Initializing socket connection for emergency:', emergencyId)
      const socket = connectSocket(token)
      
      // Join emergency room when socket connects
      const handleConnect = () => {
        console.log('✅ Socket connected, joining emergency room:', emergencyId)
        joinEmergency(emergencyId)
      }
      
      if (socket.connected) {
        console.log('✅ Socket already connected, joining emergency room:', emergencyId)
        joinEmergency(emergencyId)
      } else {
        console.log('⏳ Waiting for socket connection...')
        socket.once('connect', handleConnect)
        // Also try to join immediately in case connection happens quickly
        setTimeout(() => {
          if (socket.connected) {
            handleConnect()
          }
        }, 100)
      }
      
      // Verify connection status periodically
      const checkConnection = setInterval(() => {
        if (socket && !socket.connected) {
          console.warn('⚠️ Socket disconnected, attempting to reconnect...')
        }
      }, 5000) // Check every 5 seconds
      
      return () => {
        socket.off('connect', handleConnect)
        clearInterval(checkConnection)
      }
    } else {
      console.warn('⚠️ No token or emergencyId for socket connection')
    }
  }, [emergencyId])

  // Set up Socket.io listener for new messages
  useEffect(() => {
    const handleNewMessage = (data: any) => {
      console.log('📨 Received new message via socket:', data)
      if (data.emergencyId === emergencyId) {
        // Skip socket message if it's from current user (already shown via optimistic update)
        if (data.userId === currentUserId) {
          console.log('⚠️ Message from current user, skipping socket update (already shown via optimistic update)')
          return
        }
        
        console.log('✅ Message matches current emergency, adding to messages immediately')
        // Check if message already exists (prevent duplicates)
        setMessages((prev) => {
          const exists = prev.some(msg => msg.id === data.messageId)
          if (exists) {
            console.log('⚠️ Message already exists, skipping duplicate')
            return prev
          }
          return [...prev, {
            id: data.messageId,
            emergency_id: data.emergencyId,
            user_id: data.userId,
            user_email: data.user_email,
            user_display_name: data.user_display_name,
            message: data.message,
            image_url: data.image_url,
            audio_url: data.audio_url || null,
            video_url: data.video_url || null,
            created_at: data.created_at,
          }]
        })
      } else {
        console.log('⚠️ Message emergencyId does not match:', data.emergencyId, 'vs', emergencyId)
      }
    }

    console.log('🔌 Setting up socket message listener for emergency:', emergencyId)
    onNewMessage(handleNewMessage)

    return () => {
      console.log('🧹 Cleaning up socket message listener')
      removeMessageListener(handleNewMessage)
    }
  }, [emergencyId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadMessages = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Loading messages for emergency:', emergencyId)
      const response = await api.get(`/emergencies/${emergencyId}/messages`)
      console.log('Messages loaded:', response.data.messages)
      setMessages(response.data.messages || [])
    } catch (err: any) {
      console.error('Failed to load messages:', err)
      console.error('Error details:', err.response?.data || err.message)
      setError(`Failed to load messages: ${err.response?.data?.error || err.message}. Please refresh the page.`)
      // Set empty array on error so UI doesn't show loading forever
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file is too large. Maximum size is 5MB.')
      return
    }

    setSelectedImage(file)
    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Helper function to get media devices API with fallback for older browsers
  const getUserMedia = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
    // Check if modern API is available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return navigator.mediaDevices.getUserMedia(constraints)
    }
    
    // Fallback to legacy API (older Safari/iOS)
    if ((navigator as any).getUserMedia) {
      return new Promise((resolve, reject) => {
        (navigator as any).getUserMedia(constraints, resolve, reject)
      })
    }
    
    // Check if we're on HTTPS or localhost/local network
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.startsWith('192.168.') ||
                     window.location.hostname.startsWith('10.0.') ||
                     window.location.hostname.startsWith('172.16.')
    
    if (!isSecure) {
      throw new Error('Media access requires HTTPS. Please use a secure connection.')
    }
    
    // Detect iOS Safari
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    
    if (isIOSSafari) {
      throw new Error('Media recording requires iOS 11+ and Safari. Please update your iOS version or use a different browser.')
    }
    
    throw new Error('Media recording is not supported in this browser. Please use Safari 11+, Chrome, or Firefox.')
  }

  // Helper function to get supported MIME type for MediaRecorder
  const getSupportedMimeType = (): string | null => {
    // Check if MediaRecorder is available
    if (typeof MediaRecorder === 'undefined') {
      return null
    }
    
    // Try different MIME types in order of preference
    const types = [
      'audio/webm;codecs=opus',  // Chrome, Firefox, Edge
      'audio/webm',              // Fallback for webm
      'audio/mp4',               // Safari, iOS
      'audio/aac',               // Safari alternative
      'audio/ogg;codecs=opus',   // Firefox alternative
      'audio/wav',              // Universal fallback
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    // If no specific type is supported, return null to let browser choose
    return null
  }

  // Voice recording functions
  const startRecording = async () => {
    try {
      // Check if MediaRecorder is supported
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Audio recording is not supported in this browser. Please use Safari 11+, Chrome, or Firefox.')
      }
      
      const stream = await getUserMedia({ audio: true })
      
      // Get supported MIME type
      const mimeType = getSupportedMimeType()
      const options = mimeType ? { mimeType } : {}
      
      let mediaRecorder: MediaRecorder
      try {
        mediaRecorder = new MediaRecorder(stream, options)
      } catch (err: any) {
        // If MediaRecorder creation fails, try without options (let browser choose)
        console.warn('Failed to create MediaRecorder with options, trying default:', err)
        mediaRecorder = new MediaRecorder(stream)
      }
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Get the actual MIME type from the recorder or use a fallback
        const actualMimeType = mediaRecorder.mimeType || 
                               (audioChunksRef.current[0]?.type) || 
                               'audio/webm'
        
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType })
        setAudioBlob(audioBlob)
        const audioUrl = URL.createObjectURL(audioBlob)
        setAudioPreview(audioUrl)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start audio timer
      audioTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err: any) {
      console.error('Failed to start recording:', err)
      
      // Better error messages for different error types
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Please allow microphone access in your browser settings.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.')
      } else if (err.name === 'NotSupportedError' || err.message?.includes('not supported')) {
        // Detect iOS Safari for better error message
        const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
        if (isIOSSafari) {
          setError('Audio recording requires iOS 11+ and Safari. Please update your iOS version.')
        } else {
          setError('Audio recording is not supported in this browser. Please try Chrome, Firefox, or Safari.')
        }
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Microphone is already in use by another application. Please close other apps using the microphone.')
      } else if (err.message) {
        setError(err.message)
      } else {
        setError(`Failed to access microphone: ${err.message || 'Unknown error'}. Please check permissions.`)
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current)
        audioTimerRef.current = null
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setRecordingTime(0)
      setAudioBlob(null)
      setAudioPreview(null)
      audioChunksRef.current = []
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current)
        audioTimerRef.current = null
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current)
        audioTimerRef.current = null
      }
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current)
        videoTimerRef.current = null
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
      if (videoRecorderRef.current && isRecordingVideo) {
        videoRecorderRef.current.stop()
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioPreview) {
        URL.revokeObjectURL(audioPreview)
      }
      if (videoPreview) {
        URL.revokeObjectURL(videoPreview)
      }
    }
  }, [isRecording, isRecordingVideo, audioPreview, videoPreview])

  const removeAudio = () => {
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview)
    }
    setAudioBlob(null)
    setAudioPreview(null)
    setRecordingTime(0)
  }

  // Video recording functions
  const startVideoRecording = async () => {
    try {
      // Check if MediaRecorder is supported
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Video recording is not supported in this browser. Please use Safari 11+, Chrome, or Firefox.')
      }
      
      const stream = await getUserMedia({ 
        video: true, 
        audio: true 
      })
      
      videoStreamRef.current = stream
      
      // Get supported MIME type for video
      // Safari/iOS prefers mp4, Chrome/Firefox prefer webm
      const videoTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4', // Safari/iOS
        'video/quicktime', // iOS alternative
      ]
      
      let mimeType: string | null = null
      for (const type of videoTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          break
        }
      }
      
      const options = mimeType ? { mimeType } : {}
      
      let videoRecorder: MediaRecorder
      try {
        videoRecorder = new MediaRecorder(stream, options)
      } catch (err: any) {
        console.warn('Failed to create VideoRecorder with options, trying default:', err)
        videoRecorder = new MediaRecorder(stream)
      }
      
      videoRecorderRef.current = videoRecorder
      videoChunksRef.current = []

      videoRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data)
        }
      }

      videoRecorder.onstop = () => {
        const actualMimeType = videoRecorder.mimeType || 
                               (videoChunksRef.current[0]?.type) || 
                               'video/webm'
        
        const videoBlob = new Blob(videoChunksRef.current, { type: actualMimeType })
        setVideoBlob(videoBlob)
        const videoUrl = URL.createObjectURL(videoBlob)
        setVideoPreview(videoUrl)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        videoStreamRef.current = null
      }

      videoRecorder.start()
      setIsRecordingVideo(true)
      setRecordingTime(0)

      // Start video timer
      videoTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err: any) {
      console.error('Failed to start video recording:', err)
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera/microphone permission denied. Please allow camera and microphone access in your browser settings.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found. Please connect a camera and try again.')
      } else if (err.name === 'NotSupportedError' || err.message?.includes('not supported')) {
        // Detect iOS Safari for better error message
        const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
        if (isIOSSafari) {
          setError('Video recording requires iOS 11+ and Safari. Please update your iOS version.')
        } else {
          setError('Video recording is not supported in this browser. Please try Chrome, Firefox, or Safari.')
        }
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is already in use by another application. Please close other apps using the camera.')
      } else if (err.message) {
        setError(err.message)
      } else {
        setError(`Failed to access camera: ${err.message || 'Unknown error'}. Please check permissions.`)
      }
    }
  }

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && isRecordingVideo) {
      videoRecorderRef.current.stop()
      setIsRecordingVideo(false)
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current)
        videoTimerRef.current = null
      }
    }
  }

  const cancelVideoRecording = () => {
    if (videoRecorderRef.current) {
      videoRecorderRef.current.stop()
      setIsRecordingVideo(false)
      setRecordingTime(0)
      setVideoBlob(null)
      setVideoPreview(null)
      videoChunksRef.current = []
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current)
        videoTimerRef.current = null
      }
    }
    // Stop video stream
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop())
      videoStreamRef.current = null
    }
  }

  const removeVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview)
    }
    setVideoBlob(null)
    setVideoPreview(null)
    setRecordingTime(0)
  }

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() && !selectedImage && !audioBlob && !videoBlob) {
      return
    }

    // Verify socket connection before sending
    const socket = getSocket()
    if (!socket || !socket.connected) {
      console.warn('⚠️ Socket not connected, message may be delayed')
    } else {
      console.log('✅ Socket connected, message will be delivered instantly')
    }

    try {
      setSending(true)
      setError(null)

      const formData = new FormData()
      if (messageText.trim()) {
        formData.append('message', messageText.trim())
      }
      if (selectedImage) {
        formData.append('image', selectedImage)
      }
      if (audioBlob) {
        // Get the MIME type from the blob
        const mimeType = audioBlob.type || 'audio/webm'
        
        // Determine file extension based on MIME type
        let extension = 'webm' // default
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
          extension = 'm4a'
        } else if (mimeType.includes('ogg')) {
          extension = 'ogg'
        } else if (mimeType.includes('wav')) {
          extension = 'wav'
        } else if (mimeType.includes('aac')) {
          extension = 'aac'
        } else if (mimeType.includes('webm')) {
          extension = 'webm'
        }
        
        // Create file with correct extension and MIME type
        const audioFile = new File([audioBlob], `voice-${Date.now()}.${extension}`, { type: mimeType })
        formData.append('audio', audioFile)
      }
      if (videoBlob) {
        // Get the MIME type from the blob
        const mimeType = videoBlob.type || 'video/webm'
        
        // Determine file extension based on MIME type
        let extension = 'webm' // default
        if (mimeType.includes('mp4') || mimeType.includes('m4v')) {
          extension = 'mp4'
        } else if (mimeType.includes('quicktime') || mimeType.includes('mov')) {
          extension = 'mov'
        } else if (mimeType.includes('webm')) {
          extension = 'webm'
        } else if (mimeType.includes('3gpp')) {
          extension = '3gp'
        }
        
        // Create file with correct extension and MIME type
        const videoFile = new File([videoBlob], `video-${Date.now()}.${extension}`, { type: mimeType })
        console.log('📹 Sending video file:', {
          mimeType: mimeType,
          extension: extension,
          size: videoBlob.size,
          blobType: videoBlob.type
        })
        formData.append('video', videoFile)
      }

      const response = await api.post(`/emergencies/${emergencyId}/messages`, formData)
      const sentMessage = response.data.message
      console.log('Message sent successfully:', sentMessage)

      // Add message to state immediately (optimistic update)
      // This ensures sender sees their message right away, even if socket doesn't work
      // Backend now includes user_email in response
      setMessages((prev) => [...prev, {
        id: sentMessage.id,
        emergency_id: sentMessage.emergency_id || emergencyId,
        user_id: sentMessage.user_id,
        user_email: sentMessage.user_email || getCurrentUserEmail() || 'You',
        user_display_name: sentMessage.user_display_name,
        message: sentMessage.message,
        image_url: sentMessage.image_url,
        audio_url: sentMessage.audio_url,
        video_url: sentMessage.video_url,
        created_at: sentMessage.created_at || new Date().toISOString(),
      }])

      // Clear input
      setMessageText('')
      removeImage()
      removeAudio()
      removeVideo()

      // Note: Message should appear instantly via:
      // 1. Optimistic update (already done above)
      // 2. Socket.io broadcast (for other users)
      // No need for setTimeout fallback - it causes delays
      // Only reload if socket is not connected (as a last resort)
      const socket = getSocket()
      if (!socket || !socket.connected) {
        console.warn('⚠️ Socket not connected, reloading messages as fallback')
        setTimeout(() => {
          loadMessages()
        }, 1000) // Only reload if socket is down
      }
    } catch (err: any) {
      console.error('Failed to send message:', err)
      setError(err.response?.data?.error || 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getImageUrl = (imageUrl: string | null): string => {
    if (!imageUrl) return ''
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    const baseUrl = API_BASE_URL.replace('/api', '')
    return `${baseUrl}${imageUrl}`
  }

  const getAudioUrl = (audioUrl: string | null): string => {
    if (!audioUrl) return ''
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    const baseUrl = API_BASE_URL.replace('/api', '')
    return `${baseUrl}${audioUrl}`
  }

  const getVideoUrl = (videoUrl: string | null): string => {
    if (!videoUrl) return ''
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    const baseUrl = API_BASE_URL.replace('/api', '')
    return `${baseUrl}${videoUrl}`
  }

  if (loading) {
    return (
      <div className="emergency-chat">
        <div className="chat-loading">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="emergency-chat">
      <div className="chat-header">
        <h3>Emergency Chat</h3>
      </div>

      {error && (
        <div className="chat-error">
          {error}
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.user_id === currentUserId
            return (
              <div
                key={message.id}
                className={`message ${isOwnMessage ? 'message-own' : 'message-other'}`}
              >
                <div className="message-content">
                  {!isOwnMessage && (
                    <div className="message-sender">{message.user_display_name || message.user_email}</div>
                  )}
                  {message.message && (
                    <div className="message-text">{message.message}</div>
                  )}
                  {message.image_url && (
                    <div className="message-image">
                      <img
                        src={getImageUrl(message.image_url)}
                        alt="Shared image"
                        onClick={() => setExpandedImage(getImageUrl(message.image_url))}
                        onError={(e) => {
                          console.error('Failed to load image:', message.image_url)
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  {message.audio_url && (
                    <div className="message-audio">
                      <audio controls src={getAudioUrl(message.audio_url)}>
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                  {message.video_url && (
                    <div className="message-video">
                      <video controls src={getVideoUrl(message.video_url)}>
                        Your browser does not support the video element.
                      </video>
                    </div>
                  )}
                  <div className="message-time">{formatTimestamp(message.created_at)}</div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {imagePreview && (
        <div className="image-preview">
          <img src={imagePreview} alt="Preview" />
          <button onClick={removeImage} className="preview-remove">×</button>
        </div>
      )}

      {(isRecording || isRecordingVideo) && (
        <div className="recording-indicator">
          <div className="recording-dot"></div>
          <span>Recording {isRecordingVideo ? 'video' : 'audio'}: {formatRecordingTime(recordingTime)}</span>
          <button onClick={isRecordingVideo ? stopVideoRecording : stopRecording} className="stop-recording-btn">Stop</button>
          <button onClick={isRecordingVideo ? cancelVideoRecording : cancelRecording} className="cancel-recording-btn">Cancel</button>
        </div>
      )}

      {audioPreview && !isRecording && (
        <div className="audio-preview">
          <audio controls src={audioPreview} />
          <button onClick={removeAudio} className="preview-remove">×</button>
        </div>
      )}

      {videoPreview && !isRecordingVideo && (
        <div className="video-preview">
          <video controls src={videoPreview} />
          <button onClick={removeVideo} className="preview-remove">×</button>
        </div>
      )}

      <div className="chat-input">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSendMessage()
            }
          }}
          placeholder="Type a message..."
          disabled={sending}
          className="message-input"
        />
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="icon-button photo-button"
          disabled={sending || isRecording || isRecordingVideo}
          title="Upload photo"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zm6.5-6H17l-1.5-2h-7L7 6.5H5.5c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h13c1.1 0 2-.9 2-2v-9c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>
        {!isRecording && !isRecordingVideo && !audioPreview ? (
          <button
            onClick={startRecording}
            className="icon-button voice-button"
            disabled={sending}
            title="Record voice message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
        ) : null}
        {!isRecording && !isRecordingVideo && !videoPreview ? (
          <button
            onClick={startVideoRecording}
            className="icon-button video-button"
            disabled={sending}
            title="Record video message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </button>
        ) : null}
        <button
          onClick={handleSendMessage}
          disabled={sending || isRecording || isRecordingVideo || (!messageText.trim() && !selectedImage && !audioBlob && !videoBlob)}
          className="send-button"
          title="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>

      {expandedImage && (
        <div className="image-modal" onClick={() => setExpandedImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="image-modal-close"
              onClick={() => setExpandedImage(null)}
            >
              ×
            </button>
            <img src={expandedImage} alt="Expanded" />
          </div>
        </div>
      )}
    </div>
  )
}

