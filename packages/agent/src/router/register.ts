import {
  RegistryRecord,
  SkillDefinition,
  SkillRegistry,
  ToolDefinition,
  ToolRegistry,
} from "./types";

abstract class ConfigurableRegistryCenter<
  TDefinition extends {
    enabled?: boolean;
    tags?: string[];
    metadata?: Record<string, unknown>;
  },
> {
  protected readonly records = new Map<string, RegistryRecord<TDefinition>>();

  constructor(definitions: TDefinition[] = []) {
    this.replaceAll(definitions);
  }

  protected abstract getId(definition: TDefinition): string;

  list(): TDefinition[] {
    return [...this.records.values()]
      .filter((record) => record.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map((record) => record.definition);
  }

  getRecord(id: string): RegistryRecord<TDefinition> | undefined {
    return this.records.get(id);
  }

  register(
    definition: TDefinition,
    options?: Partial<RegistryRecord<TDefinition>>,
  ): void {
    const id = this.getId(definition);
    this.records.set(id, {
      id,
      definition,
      enabled: definition.enabled !== false && options?.enabled !== false,
      priority: options?.priority ?? 0,
      tags: options?.tags ?? definition.tags ?? [],
      metadata: options?.metadata ?? definition.metadata,
    });
  }

  setEnabled(id: string, enabled: boolean): void {
    const existing = this.records.get(id);
    if (!existing) {
      return;
    }

    this.records.set(id, {
      ...existing,
      enabled,
    });
  }

  replaceAll(definitions: TDefinition[]): void {
    this.records.clear();
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  findByTag(tag: string): TDefinition[] {
    return [...this.records.values()]
      .filter((record) => record.enabled && record.tags.includes(tag))
      .sort((a, b) => b.priority - a.priority)
      .map((record) => record.definition);
  }
}

export class InMemorySkillRegistry
  extends ConfigurableRegistryCenter<SkillDefinition>
  implements SkillRegistry
{
  protected getId(skill: SkillDefinition): string {
    return skill.skillId;
  }

  getById(skillId: string): SkillDefinition | undefined {
    return this.records.get(skillId)?.definition;
  }
}

export class InMemoryToolRegistry
  extends ConfigurableRegistryCenter<ToolDefinition>
  implements ToolRegistry
{
  protected getId(tool: ToolDefinition): string {
    return tool.toolName;
  }

  getByName(toolName: string): ToolDefinition | undefined {
    return this.records.get(toolName)?.definition;
  }
}
