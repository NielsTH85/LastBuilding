import type { Build } from "@eob/build-model";

export type LootFilterStrictness = "soft" | "medium" | "strict";

interface StrictnessConfig {
  minOnSameItem: number;
  color: number;
  emphasized: boolean;
  label: string;
}

const STRICTNESS_CONFIG: Record<LootFilterStrictness, StrictnessConfig> = {
  soft: {
    minOnSameItem: 1,
    color: 12,
    emphasized: false,
    label: "Soft",
  },
  medium: {
    minOnSameItem: 1,
    color: 8,
    emphasized: true,
    label: "Medium",
  },
  strict: {
    minOnSameItem: 2,
    color: 10,
    emphasized: true,
    label: "Strict",
  },
};

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function affixIdToInt(affixId: string): number | null {
  const match = affixId.match(/^affix-(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectBuildAffixIds(build: Build): number[] {
  const ids = new Set<number>();

  for (const item of Object.values(build.equipment)) {
    if (!item) continue;
    for (const affix of item.affixes) {
      const id = affixIdToInt(affix.affixId);
      if (id != null) ids.add(id);
    }
  }

  for (const idol of build.idols) {
    for (const affix of idol.affixes ?? []) {
      const id = affixIdToInt(affix.affixId);
      if (id != null) ids.add(id);
    }
  }

  return [...ids].sort((a, b) => a - b);
}

function renderRule(params: {
  order: number;
  type: "SHOW" | "HIDE";
  name: string;
  color?: number;
  emphasized?: boolean;
  conditionsXml: string;
}): string {
  return [
    "    <Rule>",
    `      <type>${params.type}</type>`,
    "      <conditions>",
    params.conditionsXml,
    "      </conditions>",
    `      <color>${params.color ?? 0}</color>`,
    "      <isEnabled>true</isEnabled>",
    "      <levelDependent_deprecated>false</levelDependent_deprecated>",
    "      <minLvl_deprecated>0</minLvl_deprecated>",
    "      <maxLvl_deprecated>0</maxLvl_deprecated>",
    `      <emphasized>${params.emphasized ? "true" : "false"}</emphasized>`,
    `      <nameOverride>${xmlEscape(params.name)}</nameOverride>`,
    "      <SoundId>0</SoundId>",
    "      <BeamId>0</BeamId>",
    `      <Order>${params.order}</Order>`,
    "    </Rule>",
  ].join("\n");
}

function renderRarityCondition(rarity: string): string {
  return [
    "        <Condition i:type=\"RarityCondition\">",
    `          <rarity>${rarity}</rarity>`,
    "          <minLegendaryPotential i:nil=\"true\" />",
    "          <maxLegendaryPotential i:nil=\"true\" />",
    "          <minWeaversWill i:nil=\"true\" />",
    "          <maxWeaversWill i:nil=\"true\" />",
    "          <advanced_DEPRECATED>false</advanced_DEPRECATED>",
    "          <requiredLegendaryPotential_DEPRECATED>0</requiredLegendaryPotential_DEPRECATED>",
    "          <requiredWeaversWill_DEPRECATED>0</requiredWeaversWill_DEPRECATED>",
    "        </Condition>",
  ].join("\n");
}

function renderAffixCondition(affixIds: number[], minOnSameItem: number): string {
  const affixesXml = affixIds.length
    ? affixIds.map((id) => `            <int>${id}</int>`).join("\n")
    : "";

  return [
    "        <Condition i:type=\"AffixCondition\">",
    "          <affixes>",
    affixesXml,
    "          </affixes>",
    "          <comparsion>ANY</comparsion>",
    "          <comparsionValue>0</comparsionValue>",
    `          <minOnTheSameItem>${minOnSameItem}</minOnTheSameItem>`,
    "          <combinedComparsion>ANY</combinedComparsion>",
    "          <combinedComparsionValue>1</combinedComparsionValue>",
    "          <advanced>false</advanced>",
    "        </Condition>",
  ].join("\n");
}

export function generateLootFilterXml(build: Build, strictness: LootFilterStrictness): string {
  const cfg = STRICTNESS_CONFIG[strictness];
  const affixIds = collectBuildAffixIds(build);
  const className = build.character.classId;
  const masteryName = build.character.masteryId ?? "base";

  const rules: string[] = [];

  // Always show high-value rarities.
  rules.push(
    renderRule({
      order: 3,
      type: "SHOW",
      name: "Always show Unique/Set/Legendary/Exalted",
      emphasized: true,
      color: 0,
      conditionsXml: renderRarityCondition("UNIQUE SET LEGENDARY EXALTED"),
    }),
  );

  // Build-focused affix highlights.
  if (affixIds.length > 0) {
    rules.push(
      renderRule({
        order: 2,
        type: "SHOW",
        name: `Build affixes (${cfg.label})`,
        color: cfg.color,
        emphasized: cfg.emphasized,
        conditionsXml: renderAffixCondition(affixIds, cfg.minOnSameItem),
      }),
    );
  }

  // Small noise reduction that is generally safe.
  rules.push(
    renderRule({
      order: 1,
      type: "HIDE",
      name: "Hide Normal items at level 15+",
      conditionsXml: [
        renderRarityCondition("NORMAL"),
        "        <Condition i:type=\"CharacterLevelCondition\">",
        "          <minimumLvl>15</minimumLvl>",
        "          <maximumLvl>100</maximumLvl>",
        "        </Condition>",
      ].join("\n"),
    }),
  );

  const filterName = `Last Building - ${className}-${masteryName} (${cfg.label})`;
  const description =
    "Auto-generated by Last Building. Import in-game with Shift+F > Import Filter > Paste Clipboard Contents.";

  return [
    "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
    "<ItemFilter xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\">",
    `  <name>${xmlEscape(filterName)}</name>`,
    "  <filterIcon>2</filterIcon>",
    "  <filterIconColor>16</filterIconColor>",
    `  <description>${xmlEscape(description)}</description>`,
    "  <lastModifiedInVersion>1.0.0</lastModifiedInVersion>",
    "  <lootFilterVersion>5</lootFilterVersion>",
    "  <rules>",
    rules.join("\n"),
    "  </rules>",
    "</ItemFilter>",
    "",
  ].join("\n");
}
