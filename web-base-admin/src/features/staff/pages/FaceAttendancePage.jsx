import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Space, Spin, Typography, message } from 'antd';
import { CameraOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../../contexts/AuthContext';
import api, { extractData, handleApiError } from '../../../services/api';

const { Title, Text } = Typography;

export default function FaceAttendancePage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [selfie, setSelfie] = useState('');
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const employeeId = user?.employee_id || user?.employee?.employee_id;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const loadToday = useCallback(async () => {
    if (!employeeId) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await api.get('/attendance/today', { params: { employee_id: employeeId, per_page: 5 } });
      const payload = extractData(response, {});
      const rows = Array.isArray(payload) ? payload : (payload?.data || []);
      setToday(rows[0] || null);
    } catch (error) {
      message.error(handleApiError(error, 'Could not load today attendance.'));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadToday();
    return () => stopCamera();
  }, [loadToday, stopCamera]);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        message.error('Camera requires HTTPS or localhost in a supported browser.');
        return;
      }
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setSelfie('');
      setCameraReady(true);
    } catch {
      message.error('Camera permission denied or camera unavailable.');
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return message.warning('Wait for the camera preview.');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setSelfie(canvas.toDataURL('image/jpeg', 0.88));
    stopCamera();
  };

  const punch = async () => {
    if (!employeeId || !selfie) return;
    const isTimeOut = Boolean(today?.time_in && !today?.time_out);
    setSubmitting(true);
    try {
      await api.post(isTimeOut ? '/attendance/time-out' : '/attendance/time-in', {
        employee_id: employeeId,
        selfie,
        captured_at: new Date().toISOString(),
        device_info: 'Web Face Attendance',
      });
      message.success(isTimeOut ? 'Time-out recorded.' : 'Time-in recorded.');
      setSelfie('');
      await loadToday();
    } catch (error) {
      message.error(handleApiError(error, 'Attendance verification failed. No attendance punch was recorded.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!employeeId) {
    return <Card style={{ maxWidth: 680, margin: '40px auto' }}><Alert type="error" showIcon message="Employee profile is not linked to this login" description="Ask HR to link your user account to an employee record before using web attendance."/></Card>;
  }

  const isTimeOut = Boolean(today?.time_in && !today?.time_out);
  const alreadyDone = Boolean(today?.time_in && today?.time_out);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Title level={2}>Face Attendance</Title>
          <Text type="secondary">Capture a live camera image to record your time-in or time-out.</Text>
        </div>
        <Card>
          {loading ? <Spin/> : (
            <Space direction="vertical" size={4}>
              <Text strong>{user?.full_name || user?.name || 'Employee'}</Text>
              <Text type="secondary">Employee ID: {employeeId}</Text>
              <Text>Today's status: {alreadyDone ? 'Time-in and time-out completed' : isTimeOut ? 'Timed in — time-out pending' : 'Not yet timed in'}</Text>
              {today?.time_in ? <Text type="secondary">Time-in: {today.time_in}</Text> : null}
              {today?.time_out ? <Text type="secondary">Time-out: {today.time_out}</Text> : null}
            </Space>
          )}
        </Card>
        <Card title="Camera verification">
          <div style={{ background: '#0f172a', borderRadius: 12, minHeight: 280, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {selfie ? <img src={selfie} alt="Captured attendance selfie" style={{ width: '100%', maxHeight: 420, objectFit: 'contain' }}/> :
              <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 420, objectFit: 'cover' }}/>}
          </div>
          <Space wrap style={{ marginTop: 12 }}>
            <Button icon={<CameraOutlined/>} onClick={startCamera} disabled={alreadyDone || loading}>Start camera</Button>
            <Button type="primary" onClick={capture} disabled={!cameraReady}>Capture</Button>
            <Button onClick={() => { setSelfie(''); stopCamera(); }}>Retake</Button>
          </Space>
          <Alert style={{ marginTop: 12 }} type="info" showIcon message="Keep your face centered and well lit. Attendance verification is performed by the backend when biometric enforcement is enabled."/>
        </Card>
        <Button
          type="primary"
          size="large"
          icon={<ClockCircleOutlined/>}
          loading={submitting}
          disabled={!selfie || alreadyDone || loading}
          onClick={punch}
        >
          {isTimeOut ? 'Verify face & Time Out' : 'Verify face & Time In'}
        </Button>
      </Space>
    </div>
  );
}
