// src/screens/LoginScreen.js
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
// FIX: Safely import haptics with fallback
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

// Safe haptic feedback function
const safeHaptic = (style = 'light') => {
  try {
    if (Haptics && Haptics.impactAsync) {
      const impactStyle = style === 'light' 
        ? Haptics.ImpactFeedbackStyle.Light 
        : Haptics.ImpactFeedbackStyle.Medium;
      Haptics.impactAsync(impactStyle).catch(() => {});
    }
  } catch (error) {
    // Silently fail if haptics not available
    console.log('Haptic feedback not available');
  }
};

const LoginScreen = ({ navigation }) => {
  const { login, register, isLoading: authLoading, setGuestMode } = useAuth();

  const openMainApp = () => navigation.reset({
    index: 0,
    routes: [{ name: 'Main' }],
  });

  const openAttendanceTracking = () => navigation.reset({
    index: 0,
    routes: [{ name: 'AttendanceTracking' }],
  });

  const canOpenAttendance = (result) => {
    const role = String(result?.role || result?.user?.role || '').toLowerCase();
    return !!result?.user?.canAccessAttendance || ['admin', 'super-admin', 'administrator'].includes(role);
  };
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  const handleGuestMode = async () => {
    try {
      safeHaptic('light');
      await setGuestMode();
      openMainApp();
    } catch (error) {
      console.log('Guest mode error:', error);
      Alert.alert('Error', 'Could not enter guest mode. Please try again.');
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email/username and password');
      return;
    }

    safeHaptic('light');
    setIsLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        const greeting = `Hello, ${result.user?.full_name || email}!`;

        if (canOpenAttendance(result)) {
          Alert.alert(
            'Welcome Admin!',
            `${greeting}

Where do you want to continue?`,
            [
              { text: 'Customer Page', onPress: openMainApp },
              { text: 'Attendance Tracking', onPress: openAttendanceTracking },
            ]
          );
        } else {
          Alert.alert(
            'Welcome Back!', 
            greeting,
            [{ text: 'Continue', onPress: openMainApp }]
          );
        }
      } else {
        Alert.alert('Login Failed', result.message || 'Invalid credentials');
      }
    } catch (error) {
      console.log('Login error:', error);
      Alert.alert('Error', 'An error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    
    // Validation
    if (!regFirstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return;
    }
    if (!regLastName.trim()) {
      Alert.alert('Error', 'Please enter your last name');
      return;
    }
    if (!regEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (!regPassword) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }
    if (regPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (!agreeTerms) {
      Alert.alert('Error', 'Please agree to the Terms & Conditions');
      return;
    }
    
    safeHaptic('light');
    setIsRegistering(true);
    
    try {
      const result = await register({
        first_name: regFirstName.trim(),
        last_name: regLastName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        password_confirmation: regConfirmPassword,
        phone_number: regPhone || null,
      });
      
      if (result.success) {
        Alert.alert(
          'Registration Successful!', 
          `Welcome to Dear Bab's Catering, ${regFirstName.trim()}!`, 
          [
            { 
              text: 'Continue', 
              onPress: () => {
                setRegisterModalVisible(false);
                openMainApp();
              }
            }
          ]
        );
      } else {
        Alert.alert('Registration Failed', result.message || 'Could not create account');
      }
    } catch (error) {
      console.log('Registration error:', error);
      Alert.alert('Error', 'Failed to create account. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={['#ffffff', '#fff8fa', '#fff0f5']} style={styles.gradient}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.welcomeText}>Welcome Back</Text>
                <Text style={styles.subtitleText}>Sign in to continue</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email / Username</Text>
                <View style={styles.inputContainer}>
                  <Feather name="mail" size={18} color="#b0b0b0" style={styles.inputIcon} />
                  <TextInput 
                    ref={emailInputRef}
                    style={styles.input} 
                    placeholder="Enter your email or username" 
                    placeholderTextColor="#c0c0c0" 
                    value={email} 
                    onChangeText={setEmail} 
                    autoCapitalize="none" 
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color="#b0b0b0" style={styles.inputIcon} />
                  <TextInput 
                    ref={passwordInputRef}
                    style={[styles.input, { flex: 1 }]} 
                    placeholder="Enter password" 
                    placeholderTextColor="#c0c0c0" 
                    value={password} 
                    onChangeText={setPassword} 
                    secureTextEntry={!showPassword} 
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#ff6b9d" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.loginButton} 
                onPress={handleLogin}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#ff6b9d', '#ff8fb1']}
                  style={styles.loginGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Sign In</Text>
                      <Feather name="arrow-right" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.guestButton} 
                onPress={handleGuestMode}
              >
                <Feather name="user" size={18} color="#ff6b9d" />
                <Text style={styles.guestButtonText}>Continue as Guest</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialContainer}>
                <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="google" size={20} color="#DB4437" />
                  <Text style={styles.socialButtonText}>Google</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="facebook" size={20} color="#4267B2" />
                  <Text style={styles.socialButtonText}>Facebook</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => setRegisterModalVisible(true)}>
                  <Text style={styles.registerLink}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </LinearGradient>

        {/* Register Modal - same as before */}
        <Modal 
          animationType="slide" 
          transparent={true} 
          visible={registerModalVisible} 
          onRequestClose={() => setRegisterModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <ScrollView 
                contentContainerStyle={styles.modalScrollContent} 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.modalContent}>
                  <LinearGradient colors={['#ff6b9d', '#ff8fb1']} style={styles.modalHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.modalHeaderTitle}>Create Account</Text>
                    <TouchableOpacity onPress={() => setRegisterModalVisible(false)}>
                      <Feather name="x" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </LinearGradient>
                  
                  <View style={styles.modalBody}>
                    <Text style={styles.modalSubtitle}>Join us today</Text>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>First Name</Text>
                      <View style={styles.modalInputContainer}>
                        <Feather name="user" size={18} color="#ff6b9d" />
                        <TextInput 
                          style={styles.modalInput} 
                          placeholder="Enter first name" 
                          placeholderTextColor="#b0b0b0" 
                          value={regFirstName} 
                          onChangeText={setRegFirstName}
                        />
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Last Name</Text>
                      <View style={styles.modalInputContainer}>
                        <Feather name="user" size={18} color="#ff6b9d" />
                        <TextInput 
                          style={styles.modalInput} 
                          placeholder="Enter last name" 
                          placeholderTextColor="#b0b0b0" 
                          value={regLastName} 
                          onChangeText={setRegLastName}
                        />
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Email Address</Text>
                      <View style={styles.modalInputContainer}>
                        <Feather name="mail" size={18} color="#ff6b9d" />
                        <TextInput 
                          style={styles.modalInput} 
                          placeholder="Enter email address" 
                          placeholderTextColor="#b0b0b0" 
                          value={regEmail} 
                          onChangeText={setRegEmail} 
                          keyboardType="email-address" 
                          autoCapitalize="none"
                        />
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Phone Number (Optional)</Text>
                      <View style={styles.modalInputContainer}>
                        <Feather name="phone" size={18} color="#ff6b9d" />
                        <TextInput 
                          style={styles.modalInput} 
                          placeholder="Enter phone number" 
                          placeholderTextColor="#b0b0b0" 
                          value={regPhone} 
                          onChangeText={setRegPhone} 
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Password</Text>
                      <View style={styles.modalInputContainer}>
                        <Feather name="lock" size={18} color="#ff6b9d" />
                        <TextInput 
                          style={[styles.modalInput, { flex: 1 }]} 
                          placeholder="Enter password (min. 8 chars)" 
                          placeholderTextColor="#b0b0b0" 
                          value={regPassword} 
                          onChangeText={setRegPassword} 
                          secureTextEntry={!showRegPassword}
                        />
                        <TouchableOpacity onPress={() => setShowRegPassword(!showRegPassword)}>
                          <Feather name={showRegPassword ? 'eye-off' : 'eye'} size={18} color="#ff6b9d" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Confirm Password</Text>
                      <View style={styles.modalInputContainer}>
                        <Feather name="lock" size={18} color="#ff6b9d" />
                        <TextInput 
                          style={[styles.modalInput, { flex: 1 }]} 
                          placeholder="Confirm your password" 
                          placeholderTextColor="#b0b0b0" 
                          value={regConfirmPassword} 
                          onChangeText={setRegConfirmPassword} 
                          secureTextEntry={!showRegConfirmPassword}
                        />
                        <TouchableOpacity onPress={() => setShowRegConfirmPassword(!showRegConfirmPassword)}>
                          <Feather name={showRegConfirmPassword ? 'eye-off' : 'eye'} size={18} color="#ff6b9d" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <TouchableOpacity style={styles.termsContainer} onPress={() => setAgreeTerms(!agreeTerms)}>
                      <View style={[styles.termsCheckbox, agreeTerms && styles.termsCheckboxChecked]}>
                        {agreeTerms && <Feather name="check" size={10} color="#fff" />}
                      </View>
                      <Text style={styles.termsText}>
                        I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.modalRegisterButton} 
                      onPress={handleRegister} 
                      disabled={isRegistering}
                    >
                      <LinearGradient colors={['#ff6b9d', '#ff8fb1']} style={styles.modalRegisterGradient}>
                        {isRegistering ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.modalRegisterText}>Create Account</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <View style={styles.modalFooter}>
                      <Text style={styles.modalFooterText}>Already have an account? </Text>
                      <TouchableOpacity onPress={() => setRegisterModalVisible(false)}>
                        <Text style={styles.modalFooterLink}>Sign In</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  card: { 
    backgroundColor: '#ffffff', 
    marginHorizontal: 20, 
    borderRadius: 32, 
    paddingHorizontal: 24,
    paddingVertical: 32,
    shadowColor: '#ff6b9d', 
    shadowOffset: { width: 0, height: 15 }, 
    shadowOpacity: 0.12, 
    shadowRadius: 25, 
    elevation: 15,
  },
  header: { marginBottom: 24 },
  welcomeText: { fontSize: 32, fontWeight: '800', color: '#2d2d2d', marginBottom: 4 },
  subtitleText: { fontSize: 14, color: '#8a8a8e' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#5a5a5e', marginBottom: 6 },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8f8f8', 
    borderRadius: 16, 
    borderWidth: 1.5, 
    borderColor: '#f0f0f0', 
    paddingHorizontal: 16, 
    height: 50 
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#2d2d2d' },
  loginButton: { 
    marginTop: 8, 
    borderRadius: 26, 
    overflow: 'hidden',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  loginGradient: { 
    height: 52, 
    justifyContent: 'center', 
    alignItems: 'center', 
    flexDirection: 'row' 
  },
  loginButtonText: { color: '#fff', fontSize: 17, fontWeight: '700', marginRight: 6 },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#ffd9e6',
    marginTop: 12,
    gap: 8,
  },
  guestButtonText: { fontSize: 15, fontWeight: '600', color: '#ff6b9d' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e8e8e8' },
  dividerText: { marginHorizontal: 14, color: '#8a8a8e', fontSize: 12, fontWeight: '500' },
  socialContainer: { flexDirection: 'row', gap: 12 },
  socialButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#ffffff', 
    paddingVertical: 12, 
    borderRadius: 26, 
    borderWidth: 1.2, 
    borderColor: '#f0e0e8', 
    gap: 8,
  },
  socialButtonText: { fontSize: 14, fontWeight: '600', color: '#4a4a4e' },
  registerContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 16 
  },
  registerText: { fontSize: 13, color: '#8a8a8e' },
  registerLink: { fontSize: 13, color: '#ff6b9d', fontWeight: '700' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  modalContent: { 
    backgroundColor: '#fff', 
    borderRadius: 32, 
    width: width - 32, 
    overflow: 'hidden', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 20, 
    elevation: 15 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingVertical: 18 
  },
  modalHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  modalBody: { padding: 24 },
  modalSubtitle: { fontSize: 14, color: '#8a8a8e', textAlign: 'center', marginBottom: 20 },
  modalInputGroup: { marginBottom: 14 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: '#5a5a5e', marginBottom: 4 },
  modalInputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8f8f8', 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: '#f0f0f0', 
    paddingHorizontal: 14, 
    height: 48,
    gap: 10,
  },
  modalInput: { flex: 1, fontSize: 14, color: '#2d2d2d' },
  termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  termsCheckbox: { 
    width: 20, 
    height: 20, 
    borderRadius: 5, 
    borderWidth: 2, 
    borderColor: '#ff6b9d', 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#fff' 
  },
  termsCheckboxChecked: { backgroundColor: '#ff6b9d', borderColor: '#ff6b9d' },
  termsText: { flex: 1, fontSize: 12, color: '#6b6b6e' },
  termsLink: { color: '#ff6b9d', fontWeight: '600' },
  modalRegisterButton: { borderRadius: 25, overflow: 'hidden', marginBottom: 16 },
  modalRegisterGradient: { height: 50, justifyContent: 'center', alignItems: 'center' },
  modalRegisterText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  modalFooterText: { fontSize: 13, color: '#8a8a8e' },
  modalFooterLink: { fontSize: 13, color: '#ff6b9d', fontWeight: '700' },
});

export default LoginScreen;