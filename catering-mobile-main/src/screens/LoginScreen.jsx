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

const { width, height } = Dimensions.get('window');

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

  // Admin selection modal state
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [adminGreeting, setAdminGreeting] = useState('');

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
        setAdminGreeting(greeting);

        if (canOpenAttendance(result)) {
          setAdminModalVisible(true);
          safeHaptic('medium');
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

        {/* Admin Navigation Modal - Mobile Optimized */}
        <Modal 
          animationType="fade" 
          transparent={true} 
          visible={adminModalVisible} 
          onRequestClose={() => setAdminModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setAdminModalVisible(false)}>
            <View style={styles.adminModalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.adminModalContainer}>
                  {/* Header with gradient */}
                  <LinearGradient
                    colors={['#ff6b9d', '#ff8fb1', '#ff9bb3']}
                    style={styles.adminModalHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <View style={styles.adminHeaderContent}>
                      <View style={styles.adminAvatarContainer}>
                        <LinearGradient
                          colors={['#ffffff', '#fff0f5']}
                          style={styles.adminAvatar}
                        >
                          <Feather name="user" size={28} color="#ff6b9d" />
                        </LinearGradient>
                      </View>
                      <Text style={styles.adminGreeting} numberOfLines={1}>{adminGreeting}</Text>
                      <View style={styles.adminBadge}>
                        <Feather name="shield" size={12} color="#ff6b9d" />
                        <Text style={styles.adminBadgeText}>Administrator</Text>
                      </View>
                    </View>
                  </LinearGradient>

                  <View style={styles.adminModalBody}>
                    <Text style={styles.adminModalTitle}>Choose Your Destination</Text>
                    <Text style={styles.adminModalSubtitle}>
                      Where would you like to go today?
                    </Text>

                    <View style={styles.adminOptionsContainer}>
                      {/* Customer Page Option */}
                      <TouchableOpacity 
                        style={styles.adminOptionCard}
                        onPress={() => {
                          setAdminModalVisible(false);
                          openMainApp();
                        }}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#ff6b9d', '#ff8fb1']}
                          style={styles.adminOptionGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <View style={styles.adminOptionContent}>
                            <View style={styles.adminOptionIconContainer}>
                              <Feather name="users" size={22} color="#fff" />
                            </View>
                            <View style={styles.adminOptionTextContainer}>
                              <Text style={styles.adminOptionTitle}>Customer Page</Text>
                              <Text style={styles.adminOptionDescription}>
                                Browse products, place orders, and manage your cart
                              </Text>
                            </View>
                            <View style={styles.adminOptionArrow}>
                              <Feather name="chevron-right" size={18} color="#fff" />
                            </View>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>

                      {/* Attendance Tracking Option */}
                      <TouchableOpacity 
                        style={styles.adminOptionCard}
                        onPress={() => {
                          setAdminModalVisible(false);
                          openAttendanceTracking();
                        }}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#6C63FF', '#8B83FF']}
                          style={styles.adminOptionGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <View style={styles.adminOptionContent}>
                            <View style={styles.adminOptionIconContainer}>
                              <Feather name="clock" size={22} color="#fff" />
                            </View>
                            <View style={styles.adminOptionTextContainer}>
                              <Text style={styles.adminOptionTitle}>Attendance Tracking</Text>
                              <Text style={styles.adminOptionDescription}>
                                Monitor attendance, manage timesheets, and track employee hours
                              </Text>
                            </View>
                            <View style={styles.adminOptionArrow}>
                              <Feather name="chevron-right" size={18} color="#fff" />
                            </View>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                      style={styles.adminCancelButton}
                      onPress={() => setAdminModalVisible(false)}
                    >
                      <Text style={styles.adminCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Register Modal - Compact Design */}
        <Modal 
          animationType="slide" 
          transparent={true} 
          visible={registerModalVisible} 
          onRequestClose={() => setRegisterModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalKeyboardView}
              >
                <View style={styles.modalContent}>
                  <LinearGradient 
                    colors={['#ff6b9d', '#ff8fb1']} 
                    style={styles.modalHeader} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.modalHeaderTitle}>Create Account</Text>
                    <TouchableOpacity 
                      onPress={() => setRegisterModalVisible(false)}
                      style={styles.modalCloseButton}
                    >
                      <Feather name="x" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </LinearGradient>
                  
                  <ScrollView 
                    contentContainerStyle={styles.modalBody}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"x1
                  >
                    <Text style={styles.modalSubtitle}>Sign up to Get Started</Text>
                    
                    <View style={styles.modalRow}>
                      <View style={[styles.modalInputGroup, styles.modalInputHalf]}>
                        <Text style={styles.modalLabel}>First Name</Text>
                        <View style={styles.modalInputContainer}>
                          <TextInput 
                            style={styles.modalInput} 
                            placeholder="First name" 
                            placeholderTextColor="#b0b0b0" 
                            value={regFirstName} 
                            onChangeText={setRegFirstName}
                          />
                        </View>
                      </View>
                      
                      <View style={[styles.modalInputGroup, styles.modalInputHalf]}>
                        <Text style={styles.modalLabel}>Last Name</Text>
                        <View style={styles.modalInputContainer}>
                          <TextInput 
                            style={styles.modalInput} 
                            placeholder="Last name" 
                            placeholderTextColor="#b0b0b0" 
                            value={regLastName} 
                            onChangeText={setRegLastName}
                          />
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Email Address</Text>
                      <View style={styles.modalInputContainer}>
                        <Feather name="mail" size={16} color="#ff6b9d" />
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
                      <Text style={styles.modalLabel}>Phone Number <Text style={styles.optionalText}>(Optional)</Text></Text>
                      <View style={styles.modalInputContainer}>
                        <Feather name="phone" size={16} color="#ff6b9d" />
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
                    
                    <View style={styles.modalRow}>
                      <View style={[styles.modalInputGroup, styles.modalInputHalf]}>
                        <Text style={styles.modalLabel}>Password</Text>
                        <View style={styles.modalInputContainer}>
                          <TextInput 
                            style={[styles.modalInput, { flex: 1 }]} 
                            placeholder="Min 8 chars" 
                            placeholderTextColor="#b0b0b0" 
                            value={regPassword} 
                            onChangeText={setRegPassword} 
                            secureTextEntry={!showRegPassword}
                          />
                          <TouchableOpacity onPress={() => setShowRegPassword(!showRegPassword)}>
                            <Feather name={showRegPassword ? 'eye-off' : 'eye'} size={16} color="#ff6b9d" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <View style={[styles.modalInputGroup, styles.modalInputHalf]}>
                        <Text style={styles.modalLabel}>Confirm</Text>
                        <View style={styles.modalInputContainer}>
                          <TextInput 
                            style={[styles.modalInput, { flex: 1 }]} 
                            placeholder="Confirm" 
                            placeholderTextColor="#b0b0b0" 
                            value={regConfirmPassword} 
                            onChangeText={setRegConfirmPassword} 
                            secureTextEntry={!showRegConfirmPassword}
                          />
                          <TouchableOpacity onPress={() => setShowRegConfirmPassword(!showRegConfirmPassword)}>
                            <Feather name={showRegConfirmPassword ? 'eye-off' : 'eye'} size={16} color="#ff6b9d" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                    
                    <TouchableOpacity style={styles.termsContainer} onPress={() => setAgreeTerms(!agreeTerms)} activeOpacity={0.7}>
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
                      activeOpacity={0.8}
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
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
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
  
  // Admin Modal Styles - Mobile Optimized
  adminModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  adminModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    width: width - 32,
    maxWidth: 420,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  adminModalHeader: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  adminHeaderContent: {
    alignItems: 'center',
  },
  adminAvatarContainer: {
    marginBottom: 10,
  },
  adminAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  adminGreeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
    maxWidth: '100%',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  adminModalBody: {
    padding: 20,
    paddingTop: 16,
  },
  adminModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2d2d2d',
    textAlign: 'center',
    marginBottom: 2,
  },
  adminModalSubtitle: {
    fontSize: 12,
    color: '#8a8a8e',
    textAlign: 'center',
    marginBottom: 16,
  },
  adminOptionsContainer: {
    gap: 12,
  },
  adminOptionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  adminOptionGradient: {
    padding: 14,
  },
  adminOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminOptionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminOptionTextContainer: {
    flex: 1,
  },
  adminOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 1,
  },
  adminOptionDescription: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 13,
  },
  adminOptionArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  adminCancelButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8a8a8e',
  },
  
  // Register Modal - Compact Design
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalKeyboardView: {
    width: '100%',
    alignItems: 'center',
  },
  modalContent: { 
    backgroundColor: '#fff', 
    borderRadius: 32, 
    width: width - 32, 
    maxHeight: height * 0.88,
    overflow: 'hidden', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 20, 
    elevation: 15,
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16,
  },
  modalHeaderTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#FFF' 
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: { 
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  modalSubtitle: { 
    fontSize: 13, 
    color: '#8a8a8e', 
    textAlign: 'center', 
    marginBottom: 14,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalInputGroup: { 
    marginBottom: 10,
  },
  modalInputHalf: {
    flex: 1,
  },
  modalLabel: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#5a5a5e', 
    marginBottom: 4,
  },
  optionalText: { 
    fontSize: 11, 
    color: '#b0b0b0', 
    fontWeight: '400' 
  },
  modalInputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8f8fa', 
    borderRadius: 12, 
    borderWidth: 1.5, 
    borderColor: '#f0f0f0', 
    paddingHorizontal: 12, 
    height: 42,
    gap: 8,
  },
  modalInput: { 
    flex: 1, 
    fontSize: 13, 
    color: '#1a1a1a',
    paddingVertical: 6,
  },
  termsContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12, 
    gap: 8,
    marginTop: 2,
  },
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
  termsCheckboxChecked: { 
    backgroundColor: '#ff6b9d', 
    borderColor: '#ff6b9d' 
  },
  termsText: { 
    flex: 1, 
    fontSize: 11, 
    color: '#6b6b6e', 
    lineHeight: 14,
  },
  termsLink: { 
    color: '#ff6b9d', 
    fontWeight: '600' 
  },
  modalRegisterButton: { 
    borderRadius: 25, 
    overflow: 'hidden', 
    marginBottom: 12,
  },
  modalRegisterGradient: { 
    height: 46, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalRegisterText: { 
    color: '#fff', 
    fontSize: 15, 
    fontWeight: '700' 
  },
  modalFooter: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalFooterText: { 
    fontSize: 12, 
    color: '#8a8a8e' 
  },
  modalFooterLink: { 
    fontSize: 12, 
    color: '#ff6b9d', 
    fontWeight: '700' 
  },
});

export default LoginScreen;