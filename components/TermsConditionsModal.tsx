import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AUTH_COLORS } from "../lib/authScreenTheme";
import {
  ProfileFeatureShell,
  ProfileSectionRail,
  profileFeatureStyles,
} from "./ProfileFeatureShell";

type TermsAudience = "patient" | "provider";

type TermsConditionsModalProps = {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
  audience: TermsAudience;
};

function PatientTermsBody() {
  return (
    <>
      <ProfileSectionRail title="Patient waiver" />
      <Text style={styles.leadTitle}>
        Absolute Patient Waiver and Release of Liability
      </Text>
      <Text style={styles.body}>
        By clicking &quot;Accept&quot; and using the Health_Connect platform,
        you (the &quot;User&quot;) confirm and irrevocably agree to the
        following legally binding terms. Your acceptance constitutes a complete
        and absolute waiver of your right to sue the platform.
      </Text>

      <Text style={styles.sectionTitle}>
        Technology Platform Status (Not a Healthcare Provider)
      </Text>
      <Text style={styles.body}>
        You acknowledge and agree that Kopano-Vertex Trading cc (trading as
        Health_Connect) is exclusively a technology service provider. The
        platform provides a logistical connection between you and independent
        healthcare practitioners. Under no circumstances is Health_Connect, its
        owners, directors, or employees a provider of medical care, diagnosis,
        advice, or treatment.
      </Text>

      <Text style={styles.sectionTitle}>
        Absolute Assumption of Risk and Release of Claims
      </Text>
      <Text style={styles.body}>
        You understand and agree that the entire responsibility and liability
        for the clinical services, advice, and outcomes rests solely and
        exclusively with the independent healthcare provider you select.
      </Text>

      <Text style={styles.sectionTitle}>Irrevocable Waiver</Text>
      <Text style={styles.body}>
        You hereby irrevocably and absolutely release, waive, and forever
        discharge Kopano-Vertex Trading cc, its affiliates, directors, owners,
        and employees from any and all claims, demands, liabilities, suits,
        actions, and causes of action whatsoever, whether in law or equity,
        which may arise from or relate to the medical care, advice, diagnosis,
        treatment, or judgment provided by any independent healthcare
        professional connected through the platform.
      </Text>

      <Text style={styles.sectionTitle}>No Recourse Against Platform</Text>
      <Text style={styles.body}>
        You acknowledge that your sole and exclusive recourse for any claim of
        malpractice, negligence, misdiagnosis, or professional error is
        directly against the independent healthcare provider and not against
        Health_Connect.
      </Text>

      <Text style={styles.sectionTitle}>
        Independent Contractor Status of Providers
      </Text>
      <Text style={styles.body}>
        You acknowledge and agree that the healthcare practitioners on this
        platform are independent contractors and are not employees, agents,
        partners, or representatives of Health_Connect.
      </Text>

      <Text style={styles.sectionTitle}>Emergency Services Exclusion</Text>
      <Text style={[styles.body, styles.bodyLast]}>
        You understand that this platform is NOT a substitute for emergency
        medical care. You warrant that you will not use this platform for any
        medical emergency, and you accept full liability for any harm resulting
        from attempting to use this service in an emergency.
      </Text>
    </>
  );
}

function ProviderTermsBody() {
  return (
    <>
      <ProfileSectionRail title="Provider agreement" />
      <Text style={styles.leadTitle}>
        Absolute Provider Liability and Indemnification Agreement
      </Text>
      <Text style={styles.body}>
        By accepting these terms and providing services through the
        Health_Connect platform, I (the &quot;Provider&quot;) irrevocably agree
        to the following:
      </Text>

      <Text style={styles.sectionTitle}>Status and Sole Responsibility</Text>
      <Text style={styles.body}>
        I confirm that my engagement with Kopano-Vertex Trading cc (trading as
        Health_Connect) is strictly and exclusively that of an independent
        contractor. I acknowledge that I am not, and shall not be deemed, an
        employee, agent, partner, joint venturer, or representative of
        Health_Connect for any purpose whatsoever.
      </Text>

      <Text style={styles.sectionTitle}>Absolute Clinical Liability</Text>
      <Text style={styles.body}>
        I accept full, absolute, and unreserved personal and professional
        liability for any and all acts, omissions, negligence, error, or breach
        arising from the healthcare services I provide. This absolute liability
        expressly includes, but is not limited to, all medical advice, clinical
        diagnoses, treatment plans, prescriptions, professional conduct,
        patient outcomes, and adherence to professional standards, as strictly
        governed by the Health Professions Councils of Namibia (HPCNA).
      </Text>

      <Text style={styles.sectionTitle}>
        Duty to Defend and Maximum Indemnification
      </Text>
      <Text style={styles.body}>
        I shall defend, indemnify, and hold completely harmless Kopano-Vertex
        Trading cc, its owners, directors, employees, successors, and assigns
        (collectively, the &quot;Indemnified Parties&quot;) against any and all
        losses, claims, demands, liabilities, lawsuits, judgments, fines,
        damages, expenses, and costs (including, but not limited to, reasonable
        legal and attorney fees, regardless of the merit of the claim) that may
        arise, directly or indirectly, from or relate to:
      </Text>
      <Text style={[styles.body, styles.bulletList]}>
        • My professional services or clinical decisions on or off the
        platform.{"\n"}• Any breach of my professional duties or this
        Agreement.{"\n"}• Any claim brought by a patient or third party
        regarding my medical practice.
      </Text>

      <Text style={styles.sectionTitle}>Insurance Obligation</Text>
      <Text style={[styles.body, styles.bodyLast]}>
        I confirm and warrant that I possess and shall maintain, at my sole
        expense, adequate and current professional liability insurance
        (malpractice insurance) required by the HPCNA, with coverage limits
        sufficient to cover my indemnification obligations under this
        Agreement.
      </Text>
    </>
  );
}

export default function TermsConditionsModal({
  visible,
  onClose,
  onAccept,
  audience,
}: TermsConditionsModalProps) {
  return (
    <ProfileFeatureShell
      visible={visible}
      onClose={onClose}
      kicker="Legal"
      title="Terms & Conditions"
      subtitle={
        audience === "patient"
          ? "Please read carefully before creating your patient account."
          : "Please read carefully before registering as a provider."
      }
      footer={
        <View style={styles.footerActions}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeAction}
            activeOpacity={0.85}
          >
            <Text style={styles.closeActionText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onAccept}
            style={styles.acceptAction}
            activeOpacity={0.85}
          >
            <Text style={profileFeatureStyles.primaryButtonText}>I Accept</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {audience === "patient" ? <PatientTermsBody /> : <ProviderTermsBody />}
    </ProfileFeatureShell>
  );
}

const styles = StyleSheet.create({
  leadTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: AUTH_COLORS.error,
    marginBottom: 12,
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    marginBottom: 8,
    marginTop: 4,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: AUTH_COLORS.textMuted,
    marginBottom: 16,
  },
  bodyLast: {
    marginBottom: 8,
  },
  bulletList: {
    paddingLeft: 4,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  closeAction: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  closeActionText: {
    color: AUTH_COLORS.textDark,
    fontSize: 15,
    fontWeight: "700",
  },
  acceptAction: {
    flex: 1,
    backgroundColor: "#0F3D24",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
