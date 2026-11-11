import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Select, Space, Typography, message } from 'antd';
import { CameraOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api, { ensureArray, extractData, handleApiError } from '../../../services/api';

const { Title, Text } = Typography;

export default function FaceEnrollmentPage() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState(null);
  const [consent, setConsent] = useState(false);
  const [image, setImage] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/employees', { params: { per_page: 200 } })
      .then((response) => {
        if (!active) return;
        const data = extractData(response, []);
        setEmployees(ensureArray(data));
      })
      .catch((error) => message.error(handleApiError(error, 'Unable to load employees.')));
    return () => {
      active = false;
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        message.error('Camera access requires HTTPS or localhost and a supported browser.');
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
      setCameraReady(true);
      setImage('');
    } catch (error) {
      message.error('Camera permission was denied or no camera is available.');
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      message.warning('Wait until the camera preview is ready.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setImage(canvas.toDataURL('image/jpeg', 0.88));
    stopCamera();
  };

  const submit = async () => {
    if (!employeeId || !image || !consent) {
      message.warning('Select an employee, capture a face image, and confirm consent.');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/employees/${employeeId}/face-profile`, { image, consent: true });
      message.success('Face profile enrolled and stored privately.');
      setImage('');
      setConsent(false);
      setEmployeeId(null);
    } catch (error) {
      message.error(handleApiError(error, 'Face enrollment failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Title level={2}>Employee Face Enrollment</Title>
          <Text type="secondary">Register a consented face reference for server-side attendance verification.</Text>
        </div>
        <Alert
          type="warning"
          showIcon
          message="Biometric information is sensitive personal information."
          description="Enroll only with the employee's informed consent. The image is stored on private server storage and must be protected by access controls, retention rules, and secure backups."
        />
        <Card title="1. Select employee">
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Search employee"
            style={{ width: '100%' }}
            value={employeeId}
            onChange={setEmployeeId}
            options={employees.map((employee) => ({
              value: employee.employee_id || employee.id,
              label: `${employee.full_name || employee.name || 'Employee'} (${employee.employee_code || employee.employee_id || employee.id})`,
            }))}
          />
        </Card>
        <Card title="2. Capture face reference">
          <div style={{ background: '#0f172a', borderRadius: 12, minHeight: 260, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {image ? (
              <img src={image} alt="Captured employee face reference" style={{ width: '100%', maxHeight: 420, objectFit: 'contain' }} />
            ) : (
              <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 420, objectFit: 'cover' }} />
            )}
          </div>
          <Space wrap style={{ marginTop: 12 }}>
            <Button icon={<CameraOutlined />} onClick={startCamera}>Start camera</Button>
            <Button type="primary" onClick={capture} disabled={!cameraReady}>Capture face</Button>
            <Button onClick={() => { setImage(''); stopCamera(); }}>Retake / clear</Button>
          </Space>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Use a well-lit, front-facing image with one person, no mask, and no strong obstruction.
          </Text>
        </Card>
        <Card title="3. Employee consent">
          <Checkbox checked={consent} onChange={(event) => setConsent(event.target.checked)}>
            The employee has been informed about face verification, biometric storage, its purpose, retention, access restrictions, and the available alternative attendance process, and has explicitly consented.
          </Checkbox>
        </Card>
        <Button
          type="primary"
          size="large"
          icon={<CheckCircleOutlined />}
          loading={loading}
          disabled={!employeeId || !image || !consent}
          onClick={submit}
        >
          Save face profile
        </Button>
      </Space>
    </div>
  );
}
