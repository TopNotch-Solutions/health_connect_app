import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../../../App';
import SwipeButton from 'rn-swipe-button';
import {
  FlatList,
  ImageBackground,
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
  Linking,
} from 'react-native';
import {useEffect, useState, useCallback, useRef} from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import Alert from '../../../Components/Alert';
import {SelectCard, SelectCard2} from '../Components/selectCard';
import FullScreenLoader from '../../../Components/FullScreenLoader';
import {
  meterMarisLookUp,
  PurchaseEletricityMaris,
  resendMarisCode,
  Transation,
} from '../../../apiServices/prepaidServices';
import {requestContactsPermission} from '../../../Components/Permissions';
import {selectContact} from 'react-native-select-contact';
import MarisCodeModal from '../Components/PayMarisCodeModal';
import Toast from 'react-native-simple-toast';
import PaymentSuccessfulModal from '../Components/PaymentSuccessfulModal';
import {
  createTransaction,
  getUserById,
} from '../../../apiServices/dsspservices';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getUserDetailsObject} from '../../../apiServices/Login';
import {dpo_statuses, images_base_url} from '../../../apiServices/constants';
import PromptAlert from '../Components/PromptAlert';
import {
  processCardPayment,
  validateCardPayment,
} from '../../../apiServices/transactionsHandler';
import {useFocusEffect} from '@react-navigation/native';
import DPOView from '../Components/DpoView';
import TopHeader from '../../navScreens/component/Header';
import Icon2 from 'react-native-vector-icons/MaterialIcons';
import {getRemoteConfig} from '@react-native-firebase/remote-config';
import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {selectUser, setData} from '../../../redux/features/user';
import {FONT_SIZES} from '../../../apiServices/constants';

type Card = {
  id: string;
  title: string;
  iconImage: any;
};

type PrepaidPayProps = NativeStackScreenProps<RootStackParamList, 'PrepaidPay'>;

const PrepaidPay: React.FC<PrepaidPayProps> = ({navigation, route}) => {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isProcessingDPO, setIsProcessingDPO] = useState(false);
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeResetKey, setSwipeResetKey] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [marisPhoneNumber, setMarisPhoneNumber] = useState<string>('');
  const [paymentMethodError, setPaymentMethodError] = useState(false);
  const [marisPhoneNumberError, setMarisPhoneNumberError] = useState(false);
  const [marisModalVisible, setMarisModalVisible] = useState(false);
  const [processedPhone, setProcessedPhone] = useState<string>('');
  const [paymentSuccessVisible, setPaymentSuccessVisible] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [profileImage, setProfileImage] = useState('');
  const results = route.params.results;
  const amount = route.params.amount;
  const phoneNumber = route.params.phoneNumber;
  const [promptTitle, setPromptTitle] = useState('');
  const [promptMessage, setPromptMessage] = useState('');
  const [showDpoTerms, setShowDpoTerms] = useState(false);
  const [email, setEmail] = useState('');
  const [dpo_reference, setDPO_reference] = useState('');
  const [dpo_checksum, setDPO_Checksum] = useState('');
  const [dpo_id, setDpo_id] = useState('');
  const [showDPO, setShowDpo] = useState(false);
  const [showMarisOption, setShowMarisOption] = useState(false);
  const [remoteConfigInitialized, setRemoteConfigInitialized] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertTitle, setAlertTitle] = useState('');
  const user = useSelector(selectUser);
  const paymentInFlightRef = useRef(false);
  const transactionInFlightRef = useRef(false);
  const dpoValidationInFlightRef = useRef(false);

  const AlertMessage = async (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setShowAlert(true);
  };

  const initializeRemoteConfig = async () => {
    try {
      const config = getRemoteConfig();

      await config.setDefaults({
        maris_payment: false,
      });

      await config.setConfigSettings({
        minimumFetchIntervalMillis: __DEV__ ? 0 : 0,
        fetchTimeMillis: 10000,
      });

      let fetchedRemotely = false;

      try {
        // Try to fetch with a timeout
        fetchedRemotely = await Promise.race([
          config.fetchAndActivate(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Fetch timeout')), 10000),
          ),
        ]);
        console.log('Remote Config fetched successfully');
      } catch (fetchError: any) {
        console.log(
          'Remote Config fetch failed, using cached values:',
          fetchError.message,
        );
        // Even if fetch fails, try to activate any cached values
        fetchedRemotely = await config.activate();
      }

      // Always try to get the value, whether fetch succeeded or not
      const marisPaymentValue = config.getValue('maris_payment');
      const marisPaymentEnabled = marisPaymentValue.asBoolean();

      console.log('Maris payment enabled:', marisPaymentEnabled);
      console.log('Value source:', marisPaymentValue.getSource());

      setShowMarisOption(marisPaymentEnabled);
    } catch (error) {
      console.warn('Error in Remote Config initialization:', error);
      // Fallback to showing Maris option
      setShowMarisOption(true);
    } finally {
      setRemoteConfigInitialized(true);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      getUserDetails();
      const refreshRemoteConfig = async () => {
        try {
          const config = getRemoteConfig();
          await config.fetchAndActivate();
          const marisPaymentValue = config.getValue('maris_payment');
          setShowMarisOption(marisPaymentValue.asBoolean());
        } catch (error) {
          console.warn('Refresh failed', error);
        }
      };
      refreshRemoteConfig();
    }, []),
  );

  const getAvailableCards = () => {
    const baseCards = [
      {
        id: '2',
        title: 'Pay with Visa',
        iconImage: require('../../../assets/Visa.png'),
      },
    ];

    if (showMarisOption) {
      baseCards.unshift({
        id: '1',
        title: 'Pay with Maris',
        iconImage: require('../../../assets/Maris.png'),
      });
    }

    return baseCards;
  };

  useEffect(() => {
    const getProfileDetails = async () => {
      const token = await AsyncStorage.getItem('userToken');

      if (token) {
        const user = await getUserDetailsObject(token);

        if (user.success) {
          setProfileImage(user.data.profileImage);
        }
      }
    };

    initializeRemoteConfig();
    getProfileDetails();
  }, []);

  useEffect(() => {
    if (!showMarisOption && selectedCard?.title === 'Pay with Maris') {
      setSelectedCard(null);
      setMarisPhoneNumber('');
      setMarisPhoneNumberError(false);
    }
  }, [showMarisOption, selectedCard]);



  const handleContinueMaris = async (code?: string) => {
    if (transactionInFlightRef.current) {
      console.log('Transaction already in progress');
      return;
    }

    transactionInFlightRef.current = true;
    try {
      const token = await AsyncStorage.getItem('userToken');
      const type = 'maris';
      if (token) {
        if (token) {
          setMarisModalVisible(false);
          setLoading(true);
          const res = await PurchaseEletricityMaris(
            results.data?.meterNumber,
            phoneNumber,
            amount,
            token,
            code,
          );

          if (res.success) {
            setLoading(false);
            console.log('Transaction successful:', res.data);
            setTransactionData(res.data);
            console.log('paymentSuccessVisible should be true');
            // await handleCreateTransaction(res.data);
          } else {
            setLoading(false);
            console.warn('Transaction failed:', res.error);
            await AlertMessage(
              'Payment Failed',
              res.error || 'Something went wrong',
            );
          }
        }
      }
    } catch (error: any) {
      console.error('Unexpected error during transaction:', error);
      await AlertMessage(
        'Error',
        error?.message || 'An unexpected error occurred. Please try again.',
      );
    } finally {
      transactionInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');

      if (token) {
        const result = await resendMarisCode(processedPhone, amount, token);

        if (result.success) {
          console.log('Code resent successfully:', result.data);

          Toast.show('Maris code resent successfully ', Toast.LONG, {
            backgroundColor: 'green',
          });
        } else {
          console.log('Failed to resend code:', result.error);
          Toast.show('Something went wrong ', Toast.LONG, {
            backgroundColor: 'red',
          });
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  const openContactPicker = async () => {
    try {
      const hasPermission = await requestContactsPermission();
      if (!hasPermission) {
        await AlertMessage('Permission required', 'Contacts access is needed');
        return;
      }

      const contact = await selectContact();

      if (contact?.phones?.[0]?.number) {
        const rawNumber = contact.phones[0].number;
        const cleanedNumber = rawNumber.replace(/[^0-9+]/g, '');
        setMarisPhoneNumber(cleanedNumber);
      } else {
        await AlertMessage(
          'No number found',
          'Selected contact has no phone number',
        );
      }
    } catch (error) {
      console.log('Contact picker error:', error);
      if ((error as Error).message !== 'User canceled contact selection') {
        await AlertMessage('Error', 'Failed to pick contact');
      }
    } finally {
      setMarisPhoneNumberError(false);
    }
  };

  const maskName = (fullName: string): string => {
    // Add null/undefined check
    if (!fullName || typeof fullName !== 'string') {
      return 'N/A'; // or return empty string ''
    }

    return fullName
      .split(' ')
      .map(name => {
        if (name.length <= 2) {
          return name;
        }
        const firstLetter = name[0];
        const lastLetter = name[name.length - 1];
        const masked = '*'.repeat(name.length - 2);
        return `${firstLetter}${masked}${lastLetter}`;
      })
      .join(' ');
  };

  // const accountHolder = maskName(
  //   results.data.CustomerDetail?.Name || results.data.customerName,
  // );

  const accountHolder =
    results.data.CustomerDetail?.Name || results.data.customerName;
  const erf = results.data.customerAddress;

  const handleCardSelect = (card: Card) => {
    setSelectedCard(card);
    setIsModalVisible(false);

    setMarisPhoneNumber('');
    setMarisPhoneNumberError(false);
    setPaymentMethodError(false);

    setProcessedPhone('');
  };

  //--------------------------------------------------------------------------------------------------
  const validatePhoneNumber = (phoneNumber: any) => {
    if (!phoneNumber || phoneNumber.trim() === '') {
      return {
        isValid: false,
        error: 'Please enter a phone number',
      };
    }

    const trimmedNumber = phoneNumber.trim();

    // Check for different formats
    if (trimmedNumber.startsWith('081')) {
      if (trimmedNumber.length !== 10) {
        return {
          isValid: false,
          error: 'Numbers starting with 081 must be exactly 10 digits',
        };
      }
    } else if (trimmedNumber.startsWith('264')) {
      if (trimmedNumber.length !== 12) {
        return {
          isValid: false,
          error: 'Numbers starting with 264 must be exactly 12 digits',
        };
      }
    } else if (trimmedNumber.startsWith('+264')) {
      if (trimmedNumber.length !== 13) {
        return {
          isValid: false,
          error: 'Numbers starting with +264 must be exactly 13 digits',
        };
      }
    } else {
      return {
        isValid: false,
        error: 'Number must start with 081, 264, or +264',
      };
    }

    // Additional regex validation to ensure only digits (and + for international)
    const regexPattern = /^(\+264|264|081)[0-9]*$/;
    if (!regexPattern.test(trimmedNumber)) {
      return {
        isValid: false,
        error: 'Please enter a valid phone number with only digits',
      };
    }

    return {
      isValid: true,
      error: null,
    };
  };

  //---------------------------------------------------------------------------------------------------

const handlePay = async () => {
  if (paymentInFlightRef.current) {
    return;
  }

  paymentInFlightRef.current = true;
  setResult(null);
  setPaymentMethodError(false);
  setLoading(true);

  try {
    if (parseInt(amount) > 0) {
      if (!selectedCard) {
        setPaymentMethodError(true);
        return; 
      }

      if (selectedCard.id === '2' && selectedCard.title === 'Pay with Visa') {
        processcard();
        return; 
      }

      setPaymentMethodError(true);
    }
  } catch (error) {
    console.error('Full Error Object:', error);
  } finally {
    paymentInFlightRef.current = false;
    setSwipeResetKey(prev => prev + 1);
    setIsSwiping(false);
    setLoading(false); 
  }
};

  const handlePhoneNumberChange = (text: any) => {
    setMarisPhoneNumber(text);

    if (marisPhoneNumberError) {
      setMarisPhoneNumberError(false);
    }

    if (text.length > 0) {
      const validation = validatePhoneNumber(text);
      if (!validation.isValid && text.length >= 10) {
        setMarisPhoneNumberError(true);
      }
    }
  };

  //-----------------------------------------------------------------------------------------------------------------------------------------

  const getUserDetails = async () => {
    const token = await AsyncStorage.getItem('userToken');

    if (token) {
      const getUser = await getUserById(token);

      if (getUser.success) {
        const email = getUser.data.email;

        setEmail(email);
      }
    }
  };

  const handleTermsNavigate = async () => {
    try {
      const url = 'https://maris.com.na/terms-and-conditions';
      Linking.openURL(url);
    } catch (error) {
      // Handle error
    }
  };

  const handleContinue = async (code?: string) => {
    if (isProcessingTransaction || transactionInFlightRef.current) {
      console.log('Transaction already in progress');
      return;
    }

    transactionInFlightRef.current = true;
    setIsProcessingTransaction(true);

    try {
      const token = await AsyncStorage.getItem('userToken');

      if (token) {
        if (token) {
          setMarisModalVisible(false);
          setLoading(true);
          const res = await Transation(
            results.data?.meterNumber,
            phoneNumber,
            amount,
            token,
          );

          if (res.success) {
            console.log('Transaction successful from DPO:', res.data);
            setTransactionData(res.data);
            setPaymentSuccessVisible(true);
            resetDPOVariables();
            // await handleCreateTransaction(res.data);
          } else {
            console.warn('Transaction failed:', res.error);
            await AlertMessage(
              'Payment Failed',
              res.error || 'Something went wrong',
            );
          }
        }
      }
    } catch (error: any) {
      console.error('Unexpected error during transaction:', error);
      await AlertMessage(
        'Error',
        error?.message || 'An unexpected error occurred. Please try again.',
      );
    } finally {
      transactionInFlightRef.current = false;
      setLoading(false);
      setIsProcessingTransaction(false);
    }
  };

  const getDPODate = async () => {
    const date = new Date();

    const year = date.getFullYear();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${results.data.meterNumber}-${year}-${day}-${month}-${hours}:${minutes}`;
  };

  const processcard = async () => {
    setShowDpoTerms(false);

    const reference = await getDPODate();

    if (reference) {
      if (email) {
        setLoading(true);

        const dpoamount = Math.round(Number(amount) * 100);
        // console.log('Processing DPO payment with amount (in cents):', dpoamount);

        const data = await processCardPayment(
          reference.toString(),
          dpoamount,
          email,
        );

        if (data.success) {
          setLoading(false);
          setDPO_Checksum(data.checksum);
          setDpo_id(data.pay_id);
          setDPO_reference(reference);
          setShowDpo(true);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(true);
        getUserDetails();

        await AlertMessage('Error', 'Error occurred, please try again later');
      }
    } else {
      setIsModalVisible(false);
      setLoading(false);
    }
  };

  const dpoReadMore = () => {};

  const resetDPOVariables = async () => {
    setShowDpo(false);
    setDPO_Checksum('');
    setDPO_reference('');
    setDpo_id('');
  };

  const DPO_complete_redirect = async () => {
    if (isProcessingDPO || dpoValidationInFlightRef.current) {
      console.log('Already processing DPO payment');
      return;
    }

    dpoValidationInFlightRef.current = true;
    setIsProcessingDPO(true);
    setLoading(true);

    try {
      const response = await validateCardPayment(
        dpo_id,
        dpo_reference,
        dpo_checksum,
      );

      if (response.success) {
        const match = dpo_statuses.find(
          entry =>
            entry.transaction_status ===
              parseInt(response.TRANSACTION_STATUS) &&
            entry.result_code === parseInt(response.RESULT_CODE),
        );

        if (match) {
          if (match.status) {
            setLoading(false);

            const user = await AsyncStorage.getItem('user');
            const token = await AsyncStorage.getItem('userToken');

            if (user && token) {
              handleContinue();
            }
          } else {
            setShowDpo(false);
            setLoading(false);
            await AlertMessage('Error', match.message);
          }
        } else {
          setShowDpo(false);

          setLoading(false);
          await AlertMessage(
            'Error',
            `Error Occured, please take note of the following to query ${dpo_reference}`,
          );
        }
      } else {
        setShowDpo(false);
        setLoading(false);
        resetDPOVariables();
        await AlertMessage('Error', 'An error occured');
      }
    } catch {
      setShowDpo(false);
      setLoading(false);
      await AlertMessage('Error', 'An error occured');
    } finally {
      dpoValidationInFlightRef.current = false;
      setLoading(false);
      setIsProcessingDPO(false);
    }
  };
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{flex: 1}}>
      {showAlert && (
        <Alert
          type="one"
          rightButtonText="Ok"
          title={alertTitle}
          message={alertMessage}
          onPress={() => {
            (setShowAlert(false), setAlertMessage(''), setAlertTitle(''));
          }}
        />
      )}
      {showDpoTerms && (
        <PromptAlert
          title={promptTitle}
          message={promptMessage}
          onPress={() => processcard()}
          onReadMore={() => dpoReadMore()}
          onCancel={() => setShowDpoTerms(false)}
        />
      )}

      {isModalVisible && (
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsModalVisible(false)}>
            <View style={styles.modalContainer}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <Text
                    style={[
                      styles.title3,
                      {
                        fontSize:
                          FONT_SIZES[user.fontSize ?? 'small'].subHeading,
                      },
                    ]}>
                    Select payment method
                  </Text>
                  <Text style={styles.pref}>
                    Preferred method with secure transaction
                  </Text>
                  <FlatList
                    data={getAvailableCards()}
                    keyExtractor={item => item.id}
                    renderItem={({item}) => (
                      <TouchableOpacity
                        style={styles.cardContainerModal}
                        onPress={() => handleCardSelect(item)}>
                        <SelectCard
                          title={item.title}
                          iconImage={item.iconImage}
                        />
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}

      {showDPO && dpo_checksum && dpo_reference && dpo_id && (
        <DPOView
         page='BUY ELECTRICITY'
          closeButton={resetDPOVariables}
          redirect={DPO_complete_redirect}
          reference={dpo_reference}
          checksum={dpo_checksum}
          gateid={dpo_id}
        />
      )}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" />
          <ImageBackground
            source={require('../../../assets/Prepaid.jpeg')}
            style={styles.headerContainer}>
            <TopHeader
              navigation={navigation}
              route={'Pre-Paid Purchase'}
              iconName="none"
            />
          </ImageBackground>

          <ScrollView
            scrollEnabled={!isSwiping}
            style={styles.main}
            contentContainerStyle={{paddingBottom: 20}}
            showsVerticalScrollIndicator={false}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text
                style={[
                  styles.text1,
                  {fontSize: FONT_SIZES[user.fontSize ?? 'small'].subHeading},
                ]}>
                Purchase Details
              </Text>
            </View>
            <View style={styles.details}>
              {/* Name */}
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.userTitle,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].smallText},
                  ]}>
                  Account Holder
                </Text>
                <Text
                  style={[
                    styles.userText,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].text},
                  ]}>
                  {accountHolder}
                </Text>
              </View>
              {/* ERF */}
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.userTitle,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].smallText},
                  ]}>
                  ERF
                </Text>
                <Text
                  style={[
                    styles.userText,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].text},
                  ]}>
                  {erf}
                </Text>
              </View>
              {/* Meter NO */}
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.userTitle,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].smallText},
                  ]}>
                  Meter Number
                </Text>
                <Text
                  style={[
                    styles.userText,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].text},
                  ]}>
                  {results?.data?.meterNumber}
                </Text>
              </View>
              {/* Cellphone Number */}
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.userTitle,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].smallText},
                  ]}>
                  Cellphone Number
                </Text>
                <Text
                  style={[
                    styles.userText,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].text},
                  ]}>
                  {phoneNumber}
                </Text>
              </View>
              {/* Recharge Amount */}
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.userTitle,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].smallText},
                  ]}>
                  Recharge Amount
                </Text>
                <Text
                  style={[
                    styles.userText,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].text},
                  ]}>
                  N$ {amount}
                </Text>
              </View>
              {/* Select payment methond */}
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.paymentMethodText,
                    {fontSize: FONT_SIZES[user.fontSize ?? 'small'].text},
                  ]}>
                  Payment Method
                </Text>
                <TouchableOpacity
                  style={[
                    styles.selectCardContainer,
                    paymentMethodError && {borderColor: 'red', borderWidth: 1},
                  ]}
                  onPress={() => {
                    setIsModalVisible(true);
                    setPaymentMethodError(false);
                  }}>
                  {selectedCard?.title === 'Pay with Maris' &&
                    showMarisOption && (
                      <>
                        <View style={styles.selectedCardRow}>
                          <View style={styles.cardInfo}>
                            <SelectCard2
                              title={selectedCard.title}
                              iconImage={selectedCard.iconImage}
                            />
                          </View>
                          <Icon
                            name="chevron-down-outline"
                            size={20}
                            color="#919191"
                          />
                        </View>
                      </>
                    )}

                  {selectedCard?.title === 'Pay with Visa' && (
                    <View style={styles.selectedCardRow}>
                      <View style={styles.cardInfo}>
                        <SelectCard2
                          title={selectedCard.title}
                          iconImage={selectedCard.iconImage}
                        />
                      </View>
                      <Icon
                        name="chevron-down-outline"
                        size={20}
                        color="#919191"
                      />
                    </View>
                  )}

                  {!selectedCard?.title && (
                    <View style={styles.selectedCardRow}>
                      <Text
                        style={[
                          styles.selectCardText,
                          {fontSize: FONT_SIZES[user.fontSize ?? 'small'].text},
                        ]}>
                        Select payment method Card
                      </Text>
                      <Icon
                        name="chevron-down-outline"
                        size={20}
                        color="#919191"
                      />
                    </View>
                  )}
                </TouchableOpacity>
                {paymentMethodError && (
                  <Text style={{color: 'red', marginTop: 5, marginLeft: 5}}>
                    Please select a payment method
                  </Text>
                )}

                {selectedCard?.title === 'Pay with Maris' &&
                  showMarisOption && (
                    <>
                      <Text
                        style={[
                          styles.userTitle1,
                          {fontSize: FONT_SIZES[user.fontSize ?? 'small'].text},
                        ]}>
                        Enter Your Maris number
                      </Text>
                      <View
                        style={[
                          styles.inputContainer,
                          marisPhoneNumberError && {
                            borderColor: 'red',
                            borderWidth: 1,
                          },
                        ]}>
                        <TextInput
                          placeholder="e.g 0814124186 or 264814124186"
                          placeholderTextColor={'gray'}
                          maxLength={13}
                          style={{flex: 1, color: '#000', paddingVertical: 5}}
                          keyboardType="numeric"
                          value={marisPhoneNumber}
                          onChangeText={handlePhoneNumberChange}
                        />
                        <Icon
                          name="add-circle-outline"
                          size={25}
                          color={'#3f3f40'}
                          onPress={openContactPicker}
                        />
                      </View>
                      {marisPhoneNumberError && (
                        <Text
                          style={{color: 'red', marginTop: 5, marginLeft: 5}}>
                          Please enter a valid Maris number. Use 081 (10
                          digits), 264 (12 digits).
                        </Text>
                      )}

                      <View style={styles.TC}>
                        <Icon2 name="check-box" size={20} color="#d32f2f" />
                        <Text
                          onPress={handleTermsNavigate}
                          style={styles.termsText}>
                          I accept maris <Text style={styles.link}>Terms</Text>{' '}
                          and <Text style={styles.link}>Conditions</Text>
                        </Text>
                      </View>
                    </>
                  )}
              </View>
            </View>

            <SwipeButton
              containerStyles={styles.swipeContainer}
              railStyles={styles.rail}
              thumbIconBackgroundColor="#FFFFFF"
              thumbIconComponent={() => (
                <View style={styles.thumb}>
                  <Icon name="chevron-forward-outline" size={20} color="#000" />
                </View>
              )}
              title="Swipe to pay"
              titleStyles={[
                styles.title2,
                {fontSize: FONT_SIZES[user.fontSize ?? 'small'].subHeading},
              ]}
              railBackgroundColor="#d32f2f"
              railFillBackgroundColor="#4BB543"
              key={swipeResetKey}
              onSwipeSuccess={handlePay}
              onSwipeStart={() => setIsSwiping(true)}
              onSwipeFail={() => setIsSwiping(false)}
            />

            <View style={{height: 50}} />
          </ScrollView>

          {paymentSuccessVisible && (
            <PaymentSuccessfulModal
              isVisible={paymentSuccessVisible}
              onClose={() => setPaymentSuccessVisible(false)}
              data={transactionData}
              amount={amount}
              profileImage={`${images_base_url}/${profileImage}`}
            />
          )}

          {marisModalVisible && (
            <MarisCodeModal
              visible={marisModalVisible}
              onClose={() => setMarisModalVisible(false)}
              onContinue={handleContinueMaris}
              onResend={handleResend}
              number={marisPhoneNumber}
            />
          )}

          {loading && (
            <FullScreenLoader
              visible={loading}
              loadingText="Processing Payment..."
            />
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default PrepaidPay;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    position: 'relative',
  },
  termsText: {
    marginLeft: 10,
  },
  link: {
    color: 'red',
  },
  TC: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  headerContainer: {
    height: 160,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  selectCardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 50,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '90%',
    marginTop: 10,
  },
  selectCardText: {
    fontWeight: '500',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    paddingVertical: 5,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '90%',
    height: 50,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  main: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 10,
    overflow: 'hidden',
    marginTop: -20,
  },
  ProceedButton: {
    backgroundColor: '#E22029',
    height: 50,
    borderRadius: 10,
    width: '85%',
    alignSelf: 'center',
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: -20,
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 30,
    marginTop: 10,
  },
  title3: {
    color: '#000',
    fontWeight: '500',
    marginLeft: 10,
  },
  pref: {
    marginLeft: 10,
    marginTop: 5,
    marginBottom: 20,
    color: '#3f3f40',
  },
  details: {
    marginHorizontal: 30,
    marginTop: 10,
  },
  text1: {
    marginTop: 10,
    fontWeight: '600',
    marginLeft: 30,
  },
  swipeContainer: {
    width: '85%',
    marginTop: 30,
    borderWidth: 0,
    marginHorizontal: '7%',
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    height: 55,
  },
  selectedCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rail: {
    backgroundColor: '#4BB543',
    borderRadius: 25,
  },
  thumb: {
    width: 50,
    height: 50,
    borderRadius: 20,
    borderWidth: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  title2: {
    fontWeight: '600',
    color: '#fff',
  },
  userTitle: {
    color: '#202021',
    fontWeight: '500',
    marginBottom: 10,
  },
  userTitle1: {
    marginTop: 10,
    marginBottom: 5,
    color: '#202021',
    fontWeight: '500',
  },
  paymentMethodText: {
    color: '#202021',
    fontWeight: '500',
  },
  userText: {
    color: '#8391A1',
    fontWeight: '500',
  },
  textContainer: {
    marginTop: 25,
  },
  cardInfo: {
    flex: 1,
    marginRight: 10,
  },
  cardContainerModal: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    width: '95%',
    marginHorizontal: '3%',
    padding: 13,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
});