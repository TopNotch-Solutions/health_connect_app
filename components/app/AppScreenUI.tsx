import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { AuthBackgroundDecor } from "../AuthScreenLayout";
import ScreenLayout, { SCREEN_EDGES_STACK } from "../ScreenLayout";
import { AUTH_COLORS } from "../../lib/authScreenTheme";

export { AUTH_COLORS };

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function getGreetingEmoji() {
  const hour = new Date().getHours();
  if (hour < 12) return "🌤️";
  if (hour < 18) return "☀️";
  return "🌙";
}

export function getFirstName(fullname?: string | null) {
  return fullname?.trim().split(/\s+/)[0] || "there";
}

type AppSectionHeaderProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  onSeeAll?: () => void;
};

export function AppSectionHeader({
  icon,
  title,
  subtitle,
  onSeeAll,
}: AppSectionHeaderProps) {
  return (
    <View style={appScreenStyles.sectionHeader}>
      <View style={appScreenStyles.sectionHeaderLeft}>
        <View style={appScreenStyles.sectionIconWrap}>
          <Feather name={icon} size={18} color={AUTH_COLORS.green} />
        </View>
        <View style={appScreenStyles.sectionHeaderText}>
          <Text style={appScreenStyles.sectionTitle}>{title}</Text>
          <Text style={appScreenStyles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {onSeeAll ? (
        <TouchableOpacity
          onPress={onSeeAll}
          style={appScreenStyles.seeAllBtn}
          activeOpacity={0.85}
        >
          <Text style={appScreenStyles.linkText}>See all</Text>
          <Feather name="chevron-right" size={16} color={AUTH_COLORS.green} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

type StatPill = { icon: React.ComponentProps<typeof Feather>["name"]; label: string };

type AppHeroCardProps = {
  eyebrow: string;
  name: string;
  tagline: string;
  stats?: StatPill[];
  headerRight?: React.ReactNode;
  logoSource?: ImageSourcePropType;
};

export function AppHeroCard({
  eyebrow,
  name,
  tagline,
  stats,
  headerRight,
  logoSource = require("../../assets/images/connectlogo.png"),
}: AppHeroCardProps) {
  return (
    <View style={appScreenStyles.heroCard}>
      <View style={appScreenStyles.heroOrbLarge} pointerEvents="none" />
      <View style={appScreenStyles.heroOrbSmall} pointerEvents="none" />
      <View style={appScreenStyles.heroRow}>
        <View style={appScreenStyles.heroTextBlock}>
          <Text style={appScreenStyles.heroEyebrow}>{eyebrow}</Text>
          <Text style={appScreenStyles.heroName}>{name}</Text>
          <Text style={appScreenStyles.heroTagline}>{tagline}</Text>
        </View>
        {headerRight ?? (
          <View style={appScreenStyles.heroLogoWrap}>
            <Image source={logoSource} style={appScreenStyles.heroLogo} resizeMode="contain" />
          </View>
        )}
      </View>
      {stats && stats.length > 0 ? (
        <View style={appScreenStyles.heroStatsRow}>
          {stats.map((pill) => (
            <View key={pill.label} style={appScreenStyles.statPill}>
              <Feather name={pill.icon} size={14} color={AUTH_COLORS.green} />
              <Text style={appScreenStyles.statPillText}>{pill.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type QuickAction = {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  primary?: boolean;
};

export function AppQuickActionsRow({ actions }: { actions: QuickAction[] }) {
  return (
    <View style={appScreenStyles.quickActionsRow}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.label}
          style={appScreenStyles.quickAction}
          activeOpacity={0.88}
          onPress={action.onPress}
        >
          <View
            style={[
              appScreenStyles.quickActionIcon,
              action.primary && appScreenStyles.quickActionIconPrimary,
            ]}
          >
            <Feather
              name={action.icon}
              size={20}
              color={action.primary ? AUTH_COLORS.white : AUTH_COLORS.green}
            />
          </View>
          <Text style={appScreenStyles.quickActionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

type FilterChip = { key: string; label: string };

export function AppFilterChips({
  filters,
  active,
  onChange,
}: {
  filters: FilterChip[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={appScreenStyles.filterScroll}
    >
      {filters.map((f) => {
        const isActive = active === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => onChange(f.key)}
            style={[appScreenStyles.filterChip, isActive && appScreenStyles.filterChipActive]}
            activeOpacity={0.85}
          >
            <Text
              numberOfLines={1}
              style={[
                appScreenStyles.filterChipText,
                isActive && appScreenStyles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function AppLoadingCard({ message }: { message: string }) {
  return (
    <View style={appScreenStyles.loadingCard}>
      <ActivityIndicator size="small" color={AUTH_COLORS.green} />
      <Text style={appScreenStyles.mutedText}>{message}</Text>
    </View>
  );
}

type AppEmptyStateProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
};

export function AppEmptyState({ icon, title, body, ctaLabel, onCta }: AppEmptyStateProps) {
  return (
    <View style={appScreenStyles.emptyCard}>
      <View style={appScreenStyles.emptyIconWrap}>
        <Feather name={icon} size={32} color={AUTH_COLORS.green} />
      </View>
      <Text style={appScreenStyles.emptyTitle}>{title}</Text>
      <Text style={appScreenStyles.emptyBody}>{body}</Text>
      {ctaLabel && onCta ? (
        <TouchableOpacity style={appScreenStyles.emptyCta} onPress={onCta} activeOpacity={0.9}>
          <Feather name="arrow-right" size={16} color={AUTH_COLORS.white} />
          <Text style={appScreenStyles.emptyCtaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function AppMenuSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={appScreenStyles.menuSection}>
      <Text style={appScreenStyles.menuSectionTitle}>{title}</Text>
      <View style={appScreenStyles.menuCard}>{children}</View>
    </View>
  );
}

export function AppMenuItem({
  icon,
  label,
  onPress,
  isDestructive = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={appScreenStyles.menuItem} activeOpacity={0.85}>
      <View style={appScreenStyles.menuItemLeft}>
        <View
          style={[
            appScreenStyles.menuItemIcon,
            isDestructive && appScreenStyles.menuItemIconDestructive,
          ]}
        >
          <Feather
            name={icon}
            size={18}
            color={isDestructive ? AUTH_COLORS.error : AUTH_COLORS.green}
          />
        </View>
        <Text
          style={[
            appScreenStyles.menuItemLabel,
            isDestructive && appScreenStyles.menuItemLabelDestructive,
          ]}
        >
          {label}
        </Text>
      </View>
      {!isDestructive ? (
        <Feather name="chevron-right" size={20} color={AUTH_COLORS.inputBorder} />
      ) : null}
    </TouchableOpacity>
  );
}

export function AppMenuDivider() {
  return <View style={appScreenStyles.menuDivider} />;
}

export function NotificationsBackgroundDecor() {
  return (
    <>
      <View style={notifBackgroundStyles.topWash} pointerEvents="none" />
      <View style={[notifBackgroundStyles.ring, notifBackgroundStyles.ringOuter]} pointerEvents="none" />
      <View style={[notifBackgroundStyles.ring, notifBackgroundStyles.ringMid]} pointerEvents="none" />
      <View style={[notifBackgroundStyles.ring, notifBackgroundStyles.ringInner]} pointerEvents="none" />
      <View style={notifBackgroundStyles.leftGlow} pointerEvents="none" />
      <View style={notifBackgroundStyles.bottomArc} pointerEvents="none" />
      <View style={notifBackgroundStyles.dotRow} pointerEvents="none">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              notifBackgroundStyles.dot,
              { opacity: 0.15 + i * 0.08 },
            ]}
          />
        ))}
      </View>
    </>
  );
}

type AppScreenShellProps = {
  children: React.ReactNode;
  keyboard?: boolean;
  edges?: typeof SCREEN_EDGES_STACK;
  contentStyle?: ViewStyle;
  backgroundVariant?: "default" | "notifications";
};

export function AppScreenShell({
  children,
  keyboard,
  edges = SCREEN_EDGES_STACK,
  contentStyle,
  backgroundVariant = "default",
}: AppScreenShellProps) {
  return (
    <ScreenLayout edges={edges} backgroundColor={AUTH_COLORS.bg} keyboard={keyboard}>
      <View style={[appScreenStyles.screen, contentStyle]}>
        {backgroundVariant === "notifications" ? (
          <NotificationsBackgroundDecor />
        ) : (
          <AuthBackgroundDecor />
        )}
        {children}
      </View>
    </ScreenLayout>
  );
}

const notifBackgroundStyles = StyleSheet.create({
  topWash: {
    position: "absolute",
    top: -100,
    left: -48,
    right: -48,
    height: 300,
    borderBottomLeftRadius: 220,
    borderBottomRightRadius: 220,
    backgroundColor: "rgba(187, 247, 208, 0.4)",
  },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(22, 163, 74, 0.14)",
  },
  ringOuter: {
    top: 36,
    right: -36,
    width: 190,
    height: 190,
  },
  ringMid: {
    top: 68,
    right: -4,
    width: 126,
    height: 126,
    borderColor: "rgba(22, 163, 74, 0.18)",
  },
  ringInner: {
    top: 100,
    right: 28,
    width: 62,
    height: 62,
    borderWidth: 2,
    borderColor: "rgba(22, 163, 74, 0.28)",
    backgroundColor: "rgba(187, 247, 208, 0.25)",
  },
  leftGlow: {
    position: "absolute",
    top: "38%",
    left: -70,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(134, 239, 172, 0.22)",
  },
  bottomArc: {
    position: "absolute",
    bottom: -80,
    left: -32,
    right: -32,
    height: 220,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: "rgba(187, 247, 208, 0.28)",
  },
  dotRow: {
    position: "absolute",
    top: 168,
    left: 24,
    flexDirection: "row",
    gap: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: AUTH_COLORS.green,
  },
});

export const appScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  contentSection: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  heroCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 20,
    overflow: "hidden",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  heroOrbLarge: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  heroOrbSmall: {
    position: "absolute",
    bottom: -20,
    left: -10,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(134, 239, 172, 0.3)",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  heroEyebrow: {
    fontSize: 14,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
    marginBottom: 4,
  },
  heroName: {
    fontSize: 28,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroTagline: {
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
  },
  heroLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  heroLogo: {
    width: 48,
    height: 48,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(187, 247, 208, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  statPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  quickActionsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionIconPrimary: {
    backgroundColor: AUTH_COLORS.green,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    textAlign: "center",
  },
  filterScroll: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    height: 40,
    minWidth: 72,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  filterChipActive: {
    backgroundColor: AUTH_COLORS.green,
    borderColor: AUTH_COLORS.greenDark,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: AUTH_COLORS.textMuted,
    textTransform: "capitalize",
  },
  filterChipTextActive: {
    color: AUTH_COLORS.white,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.green,
  },
  mutedText: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
  },
  loadingCard: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  emptyCard: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 28,
    alignItems: "center",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AUTH_COLORS.greenSoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: AUTH_COLORS.green,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyCtaText: {
    color: AUTH_COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
  menuSection: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: AUTH_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuItemIconDestructive: {
    backgroundColor: "rgba(254, 226, 226, 0.8)",
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: AUTH_COLORS.textDark,
  },
  menuItemLabelDestructive: {
    color: AUTH_COLORS.error,
  },
  menuDivider: {
    height: 1,
    backgroundColor: AUTH_COLORS.inputBorder,
    marginHorizontal: 16,
  },
  profileHero: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 24,
    alignItems: "center",
    overflow: "hidden",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  profileAvatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    marginBottom: 14,
    borderWidth: 4,
    borderColor: AUTH_COLORS.inputBorder,
  },
  profileAvatarPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 4,
    borderColor: AUTH_COLORS.inputBorder,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    textAlign: "center",
  },
  profileEmail: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  roleBadge: {
    marginTop: 12,
    backgroundColor: AUTH_COLORS.greenSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  roleBadgeText: {
    color: AUTH_COLORS.green,
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },
  uploadPhotoBtn: {
    marginTop: 14,
    backgroundColor: AUTH_COLORS.greenSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  uploadPhotoText: {
    color: AUTH_COLORS.green,
    fontWeight: "700",
    fontSize: 14,
  },
  onlineToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  onlineToggleText: {
    color: AUTH_COLORS.white,
    fontWeight: "700",
    fontSize: 13,
  },
  statCard: {
    flex: 1,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 16,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: AUTH_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    marginTop: 4,
  },
  statCardHint: {
    fontSize: 11,
    color: AUTH_COLORS.textMuted,
    marginTop: 2,
  },
  requestCard: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 16,
    marginBottom: 12,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
});
