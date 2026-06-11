import { useEffect, useRef, useState } from 'react'
import api from '../services/api'
import './VideoRoom.css'

// Agora group-video room for an active emergency.
// SDK is dynamically imported so it only loads when someone opens the call.
// Credentials come from the backend (participants only) — no keys in the bundle.

interface VideoRoomProps {
  emergencyId: string
}

type CallState = 'idle' | 'connecting' | 'in-call' | 'error' | 'unavailable'

export function VideoRoom({ emergencyId }: VideoRoomProps) {
  const [callState, setCallState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [remoteUsers, setRemoteUsers] = useState<any[]>([])

  const clientRef = useRef<any>(null)
  const localTracksRef = useRef<any[]>([])
  const localVideoRef = useRef<HTMLDivElement>(null)
  const remoteContainerRef = useRef<HTMLDivElement>(null)

  const leaveCall = async () => {
    try {
      for (const track of localTracksRef.current) {
        try { track.stop(); track.close() } catch { /* already closed */ }
      }
      localTracksRef.current = []
      if (clientRef.current) {
        await clientRef.current.leave()
        clientRef.current.removeAllListeners()
        clientRef.current = null
      }
    } catch (e) {
      console.error('Error leaving call:', e)
    }
    setRemoteUsers([])
    setCallState('idle')
  }

  // Leave the call when the component unmounts (emergency ended / navigation)
  useEffect(() => {
    return () => { leaveCall() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const joinCall = async () => {
    setCallState('connecting')
    setError(null)
    try {
      // 1. Credentials (participants only)
      const { data: creds } = await api.get(`/emergencies/${emergencyId}/video-token`)

      // 2. Load the SDK on demand
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      AgoraRTC.setLogLevel(2) // warnings+

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
      clientRef.current = client

      client.on('user-published', async (user: any, mediaType: 'audio' | 'video') => {
        await client.subscribe(user, mediaType)
        if (mediaType === 'video') {
          setRemoteUsers((prev) => {
            const next = prev.filter((u) => u.uid !== user.uid)
            return [...next, user]
          })
          // play after the element exists
          setTimeout(() => user.videoTrack?.play(`remote-video-${user.uid}`), 100)
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play()
        }
      })

      client.on('user-unpublished', (user: any, mediaType: 'audio' | 'video') => {
        if (mediaType === 'video') {
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid))
        }
      })

      client.on('user-left', (user: any) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid))
      })

      // 3. Join + publish mic & camera
      await client.join(creds.appId, creds.channel, creds.token ?? null, null)
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()
      localTracksRef.current = [audioTrack, videoTrack]
      await client.publish([audioTrack, videoTrack])

      setMicOn(true)
      setCamOn(true)
      setCallState('in-call')
      setTimeout(() => videoTrack.play(localVideoRef.current!), 100)
    } catch (err: any) {
      console.error('Failed to join video call:', err)
      await leaveCall()
      if (err?.response?.status === 503) {
        setCallState('unavailable')
      } else if (err?.name === 'NotAllowedError' || /permission/i.test(String(err?.message))) {
        setCallState('error')
        setError('Camera/microphone permission denied. Allow access and try again.')
      } else {
        setCallState('error')
        setError(err?.response?.data?.error || err?.message || 'Could not join the call')
      }
    }
  }

  const toggleMic = async () => {
    const track = localTracksRef.current[0]
    if (!track) return
    await track.setEnabled(!micOn)
    setMicOn(!micOn)
  }

  const toggleCam = async () => {
    const track = localTracksRef.current[1]
    if (!track) return
    await track.setEnabled(!camOn)
    setCamOn(!camOn)
  }

  if (callState === 'unavailable') {
    return null // video not configured on the server — hide entirely
  }

  if (callState === 'idle' || callState === 'error' || callState === 'connecting') {
    return (
      <div className="video-room video-room-idle">
        <button
          onClick={joinCall}
          disabled={callState === 'connecting'}
          className="btn-join-video"
        >
          {callState === 'connecting' ? 'Connecting…' : '🎥 Join Video Call'}
        </button>
        {error && <p className="video-error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="video-room">
      <div className="video-grid" ref={remoteContainerRef}>
        <div className="video-tile local" ref={localVideoRef}>
          <span className="video-label">You{!camOn ? ' (camera off)' : ''}</span>
        </div>
        {remoteUsers.map((user) => (
          <div key={user.uid} className="video-tile" id={`remote-video-${user.uid}`}>
            <span className="video-label">Helper</span>
          </div>
        ))}
      </div>
      {remoteUsers.length === 0 && (
        <p className="video-waiting">Waiting for others to join…</p>
      )}
      <div className="video-controls">
        <button onClick={toggleMic} className={`btn-video-ctl ${micOn ? '' : 'off'}`}>
          {micOn ? '🎙 Mute' : '🔇 Unmute'}
        </button>
        <button onClick={toggleCam} className={`btn-video-ctl ${camOn ? '' : 'off'}`}>
          {camOn ? '📷 Camera off' : '📷 Camera on'}
        </button>
        <button onClick={leaveCall} className="btn-video-ctl leave">
          ❌ Leave call
        </button>
      </div>
    </div>
  )
}
