import {
  HeaderBackButton,
  iosCustomTopBarRowStyle,
  iosCustomTopBarStyle,
} from "../../../components/HeaderBackButton";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import ScreenLayout, { SCREEN_EDGES_FULL } from "../../../components/ScreenLayout";

declare global {
  var acceptProviderTermsCallback: ((accepted: boolean) => void) | undefined;
}

export default function ProviderTermsConditionsScreen() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    if (accepted) {
      router.back();
      setTimeout(() => {
        if ((globalThis as any).acceptProviderTermsCallback) {
          (globalThis as any).acceptProviderTermsCallback(true);
        }
      }, 100);
    }
  };

  return (
    <ScreenLayout edges={SCREEN_EDGES_FULL} backgroundColor="#FFFFFF">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="py-6 border-b border-gray-200" style={iosCustomTopBarStyle}>
        <View className="flex-row items-center mb-2" style={iosCustomTopBarRowStyle}>
          <HeaderBackButton color="#1F2937" size={24} />
          <Text className="text-2xl font-bold text-gray-900 ml-2">
            Terms & Conditions
          </Text>
        </View>
        <Text className="text-sm text-gray-600">
          Please read carefully before proceeding
        </Text>
      </View>

      <ScrollView className="flex-1 px-6 py-4">
        {/* Main Title */}
        <View className="bg-red-50 p-4 rounded-xl border-2 border-red-200 mb-6">
          <Text className="text-xl font-bold text-red-900 mb-2">
            ?? Absolute Provider Liability and Indemnification Agreement
          </Text>
          <Text className="text-sm text-red-800 leading-6">
            By clicking Accept and providing services through the Health_Connect
            platform, you (the Provider) confirm and irrevocably agree to the
            following legally binding terms.
          </Text>
        </View>

        {/* Section 1 */}
        <View className="mb-6">
          <View className="flex-row items-start mb-3">
            <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mr-3">
              <Text className="text-white font-bold">1</Text>
            </View>
            <Text className="text-lg font-bold text-gray-900 flex-1">
              Status and Sole Responsibility
            </Text>
          </View>
          <Text className="text-base text-gray-700 leading-6 ml-11">
            You confirm that your engagement with Kopano-Vertex Trading cc
            (trading as Health_Connect) is strictly and exclusively that of an
            independent contractor. You acknowledge that you are not, and shall
            not be deemed, an employee, agent, partner, joint venturer, or
            representative of Health_Connect for any purpose whatsoever.
          </Text>
        </View>

        {/* Section 2 */}
        <View className="mb-6">
          <View className="flex-row items-start mb-3">
            <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mr-3">
              <Text className="text-white font-bold">2</Text>
            </View>
            <Text className="text-lg font-bold text-gray-900 flex-1">
              Absolute Clinical Liability
            </Text>
          </View>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-3">
            You accept full, absolute, and unreserved personal and professional
            liability for any and all acts, omissions, negligence, error, or
            breach arising from the healthcare services you provide.
          </Text>
          <View className="ml-11 bg-gray-50 p-4 rounded-xl mb-3">
            <Text className="text-sm font-bold text-gray-900 mb-2">
              Scope of Liability:
            </Text>
            <Text className="text-sm text-gray-700 leading-5">
              This absolute liability expressly includes, but is not limited to,
              all medical advice, clinical diagnoses, treatment plans,
              prescriptions, professional conduct, patient outcomes, and
              adherence to professional standards, as strictly governed by the
              Health Professions Councils of Namibia (HPCNA).
            </Text>
          </View>
        </View>

        {/* Section 3 */}
        <View className="mb-6">
          <View className="flex-row items-start mb-3">
            <View className="w-8 h-8 rounded-full bg-red-500 items-center justify-center mr-3">
              <Text className="text-white font-bold">3</Text>
            </View>
            <Text className="text-lg font-bold text-gray-900 flex-1">
              Duty to Defend and Maximum Indemnification
            </Text>
          </View>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-3">
            You shall defend, indemnify, and hold completely harmless
            Kopano-Vertex Trading cc, its owners, directors, employees,
            successors, and assigns (the Indemnified Parties) against any and
            all losses, claims, demands, liabilities, lawsuits, judgments,
            fines, damages, expenses, and costs.
          </Text>
          <View className="ml-11 bg-gray-50 p-4 rounded-xl mb-3">
            <Text className="text-sm font-bold text-gray-900 mb-2">
              Coverage Includes:
            </Text>
            <Text className="text-sm text-gray-700 leading-5 mb-2">
              ? Your professional services or clinical decisions on or off the
              platform
            </Text>
            <Text className="text-sm text-gray-700 leading-5 mb-2">
              ? Any breach of your professional duties or this Agreement
            </Text>
            <Text className="text-sm text-gray-700 leading-5">
              ? Any claim brought by a patient or third party regarding your
              medical practice
            </Text>
          </View>
        </View>

        {/* Section 4 */}
        <View className="mb-6">
          <View className="flex-row items-start mb-3">
            <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mr-3">
              <Text className="text-white font-bold">4</Text>
            </View>
            <Text className="text-lg font-bold text-gray-900 flex-1">
              Insurance Obligation
            </Text>
          </View>
          <Text className="text-base text-gray-700 leading-6 ml-11">
            You confirm and warrant that you possess and shall maintain, at your
            sole expense, adequate and current professional liability insurance
            (malpractice insurance) required by the HPCNA, with coverage limits
            sufficient to cover your indemnification obligations under this
            Agreement.
          </Text>
        </View>

        {/* Section 5 */}
        <View className="mb-6">
          <View className="flex-row items-start mb-3">
            <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mr-3">
              <Text className="text-white font-bold">5</Text>
            </View>
            <Text className="text-lg font-bold text-gray-900 flex-1">
              Practice Banking Details & Platform Non-Liability Clause
            </Text>
          </View>

          <Text className="text-base font-bold text-gray-900 leading-6 ml-11 mb-2">
            1. Practice Banking Details & Verification
          </Text>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-3">
            1.1. Accuracy of Information: The Practice, Provider, or User
            (&quot;Practitioner&quot;) is solely responsible for ensuring that
            all banking details provided, entered, or updated within the
            Application—including bank name, account holder name, account
            number, branch code, SWIFT/IBAN, and tax identification—are
            complete, accurate, and up to date.
          </Text>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-3">
            1.2. No Independent Verification: The Company (the owner and
            operator of this mobile application) does not independently verify
            the ownership, validity, or accuracy of the banking details provided
            by the Practitioner.
          </Text>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-4">
            1.3. Notification of Changes: Any changes to banking details must be
            made directly through the secure account settings within the
            Application at least 5 business days prior to any scheduled payout
            or settlement date.
          </Text>

          <Text className="text-base font-bold text-gray-900 leading-6 ml-11 mb-2">
            2. Platform Non-Liability for Payment Transfers
          </Text>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-2">
            2.1. Disclaimer of Liability: The Company accepts no liability,
            responsibility, or obligation whatsoever for any loss, delay,
            misdirection, or failure of funds transfer resulting from:
          </Text>
          <View className="ml-11 bg-gray-50 p-4 rounded-xl mb-3">
            <Text className="text-sm text-gray-700 leading-5 mb-2">
              • Incorrect, outdated, or incomplete banking details entered into
              the Application by the Practitioner or any authorized user.
            </Text>
            <Text className="text-sm text-gray-700 leading-5 mb-2">
              • Fraudulent acts, unauthorized access, or account compromise
              occurring on the Practitioner&apos;s mobile device or account
              credentials.
            </Text>
            <Text className="text-sm text-gray-700 leading-5">
              • Reversals, holds, bank fees, or processing delays imposed by
              third-party payment processors, banking institutions, or
              clearinghouses.
            </Text>
          </View>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-4">
            2.2. Irrecoverable Transfers: In the event that funds are
            transferred or remitted to an incorrect bank account due to
            inaccurate details supplied by the Practitioner, the Company is
            under no obligation to recover or re-issue such funds. The
            Practitioner acknowledges that recovery of misdirected electronic
            funds transfers (EFTs) is subject to the policies and cooperation of
            the recipient bank and relevant financial regulations.
          </Text>

          <Text className="text-base font-bold text-gray-900 leading-6 ml-11 mb-2">
            3. Third-Party Payment Processors
          </Text>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-3">
            3.1. Payment processing services within the Application are provided
            by independent third-party payment gateways (&quot;Payment
            Processors&quot;).
          </Text>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-3">
            3.2. By using the Application to collect or disburse payments, the
            Practitioner agrees to be bound by the applicable terms and
            conditions and privacy policies of such Payment Processors.
          </Text>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-4">
            3.3. The Company shall not be held liable for any system outages,
            processing failures, security breaches, or data losses occurring
            within or caused by third-party payment gateway systems.
          </Text>

          <Text className="text-base font-bold text-gray-900 leading-6 ml-11 mb-2">
            4. Indemnification
          </Text>
          <Text className="text-base text-gray-700 leading-6 ml-11 mb-2">
            The Practitioner agrees to fully indemnify, defend, and hold
            harmless the Company, its officers, directors, employees, agents,
            and affiliates from and against any claims, losses, liabilities,
            damages, costs, or expenses (including reasonable legal fees)
            arising out of or related to:
          </Text>
          <View className="ml-11 bg-gray-50 p-4 rounded-xl mb-3">
            <Text className="text-sm text-gray-700 leading-5 mb-2">
              • Inaccurate banking details provided to or maintained on the
              Application.
            </Text>
            <Text className="text-sm text-gray-700 leading-5 mb-2">
              • Any dispute between the Practitioner and any patient, client,
              customer, or third party regarding payments, refunds, or fee
              structures.
            </Text>
            <Text className="text-sm text-gray-700 leading-5">
              • Any unauthorized access to or misuse of the
              Practitioner&apos;s mobile app login credentials or financial
              profile.
            </Text>
          </View>
        </View>

        {/* Bottom spacing for checkbox */}
        <View className="h-32" />
      </ScrollView>

      {/* Fixed Bottom Section with Checkbox and Button */}
      <View className="p-6 bg-white border-t-2 border-gray-200">
        {/* Checkbox */}
        <TouchableOpacity
          onPress={() => setAccepted(!accepted)}
          className="flex-row items-start p-4 bg-gray-50 rounded-xl border-2 border-gray-200 mb-4"
          activeOpacity={0.7}
        >
          <View
            className={`w-6 h-6 rounded-md mr-3 items-center justify-center border-2 ${accepted ? "bg-green-500 border-green-500" : "bg-white border-gray-300"}`}
          >
            {accepted && <Feather name="check" size={16} color="white" />}
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 text-sm font-bold leading-5">
              I have read, understood, and irrevocably accept all terms and
              conditions stated above.
            </Text>
          </View>
        </TouchableOpacity>

        {/* Accept Button */}
        <TouchableOpacity
          onPress={handleAccept}
          disabled={!accepted}
          className={`p-4 rounded-xl ${accepted ? "bg-green-500" : "bg-gray-300"}`}
        >
          <Text className="text-white text-center text-lg font-bold">
            Accept & Continue
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
