# Implementation Details
## Autonomous Coding Agents - 모듈별 구현 레벨 상세 정의

> 작성일: 2026-01-25
> 버전: 1.0
> 목적: 각 모듈의 구현 수준 상세 정의 (함수, 메서드, 알고리즘)

---

## 1. Knowledge Layer Implementation

### 1.1 Neo4j Client

#### 1.1.1 파일 구조
```
src/infrastructure/knowledge/neo4j/
├── neo4j-client.ts        # 메인 클라이언트
├── queries.ts             # Cypher 쿼리 빌더
├── mappers.ts             # 도메인 매퍼
├── types.ts               # 타입 정의
└── index.ts               # 공개 API
```

#### 1.1.2 Neo4jClient 클래스

```typescript
// src/infrastructure/knowledge/neo4j/neo4j-client.ts

import neo4j, { Driver, Session, Transaction } from 'neo4j-driver'

interface Neo4jConfig {
  uri: string
  username: string
  password: string
  database?: string
  maxConnectionPoolSize?: number
  connectionTimeout?: number
}

interface QueryOptions {
  timeout?: number
  database?: string
}

export class Neo4jClient {
  private driver: Driver | null = null
  private config: Neo4jConfig

  constructor(config: Neo4jConfig) {
    this.config = {
      maxConnectionPoolSize: 50,
      connectionTimeout: 30000,
      ...config,
    }
  }

  /**
   * 데이터베이스 연결
   * @throws ConnectionError - 연결 실패시
   */
  async connect(): Promise<void> {
    if (this.driver) return

    try {
      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
        {
          maxConnectionPoolSize: this.config.maxConnectionPoolSize,
          connectionTimeout: this.config.connectionTimeout,
        }
      )

      // 연결 검증
      await this.driver.verifyConnectivity()
    } catch (error) {
      throw new ConnectionError(`Failed to connect to Neo4j: ${error.message}`)
    }
  }

  /**
   * 연결 종료
   */
  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close()
      this.driver = null
    }
  }

  /**
   * 읽기 전용 쿼리 실행
   * @param cypher - Cypher 쿼리 문자열
   * @param params - 쿼리 파라미터
   * @param options - 쿼리 옵션
   */
  async query<T = unknown>(
    cypher: string,
    params: Record<string, unknown> = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    this.ensureConnected()

    const session = this.driver!.session({
      database: options.database || this.config.database,
      defaultAccessMode: neo4j.session.READ,
    })

    try {
      const result = await session.run(cypher, params)
      return result.records.map(record => this.recordToObject<T>(record))
    } finally {
      await session.close()
    }
  }

  /**
   * 쓰기 쿼리 실행 (트랜잭션 포함)
   * @param cypher - Cypher 쿼리 문자열
   * @param params - 쿼리 파라미터
   */
  async execute(
    cypher: string,
    params: Record<string, unknown> = {}
  ): Promise<void> {
    this.ensureConnected()

    const session = this.driver!.session({
      database: this.config.database,
      defaultAccessMode: neo4j.session.WRITE,
    })

    try {
      await session.executeWrite(tx => tx.run(cypher, params))
    } finally {
      await session.close()
    }
  }

  /**
   * 코드 엔티티 저장
   * @param entity - 저장할 엔티티
   * @returns 생성된 노드 ID
   */
  async storeEntity(entity: CodeEntity): Promise<string> {
    const query = `
      MERGE (e:${entity.type} {id: $id})
      SET e += $properties
      RETURN e.id as id
    `

    const result = await this.query<{ id: string }>(query, {
      id: entity.id,
      properties: this.entityToProperties(entity),
    })

    return result[0].id
  }

  /**
   * 관계 생성
   * @param fromId - 시작 노드 ID
   * @param toId - 종료 노드 ID
   * @param type - 관계 타입
   * @param properties - 관계 속성
   */
  async createRelation(
    fromId: string,
    toId: string,
    type: RelationType,
    properties: Record<string, unknown> = {}
  ): Promise<void> {
    const query = `
      MATCH (from {id: $fromId})
      MATCH (to {id: $toId})
      MERGE (from)-[r:${type}]->(to)
      SET r += $properties
    `

    await this.execute(query, { fromId, toId, properties })
  }

  /**
   * 유사 패턴 검색
   * @param pattern - 검색할 패턴
   * @param limit - 최대 결과 수
   */
  async findSimilarPatterns(
    pattern: CodePattern,
    limit: number = 10
  ): Promise<Pattern[]> {
    const query = `
      MATCH (e:${pattern.entityType})
      WHERE e.signature CONTAINS $signature
         OR e.name CONTAINS $name
      OPTIONAL MATCH (e)-[r]->(related)
      RETURN e, collect({type: type(r), node: related}) as relations
      ORDER BY e.similarity DESC
      LIMIT $limit
    `

    const results = await this.query<RawPatternResult>(query, {
      signature: pattern.signature || '',
      name: pattern.name,
      limit,
    })

    return results.map(this.mapToPattern)
  }

  /**
   * 의존성 분석
   * @param entityId - 분석할 엔티티 ID
   * @param depth - 탐색 깊이
   */
  async findDependencies(
    entityId: string,
    depth: number = 3
  ): Promise<Dependency[]> {
    const query = `
      MATCH path = (start {id: $entityId})-[:DEPENDS_ON|IMPORTS|USES*1..${depth}]->(dep)
      RETURN
        [n IN nodes(path) | n.id] as nodeIds,
        [r IN relationships(path) | type(r)] as relationTypes,
        length(path) as depth
    `

    const results = await this.query<RawDependencyResult>(query, { entityId })
    return results.map(this.mapToDependency)
  }

  /**
   * 변경 영향 분석
   * @param entityId - 변경된 엔티티 ID
   */
  async analyzeImpact(entityId: string): Promise<ImpactReport> {
    // 직접 영향을 받는 엔티티 조회
    const directImpactQuery = `
      MATCH (changed {id: $entityId})<-[:DEPENDS_ON|CALLS|USES]-(affected)
      RETURN affected.id as id, affected.type as type, 'direct' as impactType
    `

    // 간접 영향을 받는 엔티티 조회 (2-3 hop)
    const indirectImpactQuery = `
      MATCH (changed {id: $entityId})<-[:DEPENDS_ON|CALLS|USES*2..3]-(affected)
      WHERE NOT (changed)<-[:DEPENDS_ON|CALLS|USES]-(affected)
      RETURN DISTINCT affected.id as id, affected.type as type, 'indirect' as impactType
    `

    const [directResults, indirectResults] = await Promise.all([
      this.query<ImpactedEntity>(directImpactQuery, { entityId }),
      this.query<ImpactedEntity>(indirectImpactQuery, { entityId }),
    ])

    return {
      entityId,
      directImpact: directResults,
      indirectImpact: indirectResults,
      totalAffected: directResults.length + indirectResults.length,
      riskLevel: this.calculateRiskLevel(directResults.length, indirectResults.length),
    }
  }

  // Private helper methods

  private ensureConnected(): void {
    if (!this.driver) {
      throw new NotConnectedError('Neo4j client is not connected')
    }
  }

  private recordToObject<T>(record: neo4j.Record): T {
    const obj: Record<string, unknown> = {}
    record.keys.forEach(key => {
      obj[key] = this.convertNeo4jValue(record.get(key))
    })
    return obj as T
  }

  private convertNeo4jValue(value: unknown): unknown {
    if (neo4j.isInt(value)) {
      return value.toNumber()
    }
    if (Array.isArray(value)) {
      return value.map(v => this.convertNeo4jValue(v))
    }
    if (value && typeof value === 'object' && 'properties' in value) {
      return (value as neo4j.Node).properties
    }
    return value
  }

  private entityToProperties(entity: CodeEntity): Record<string, unknown> {
    return {
      name: entity.name,
      path: entity.path,
      language: entity.language,
      signature: entity.signature,
      docstring: entity.docstring,
      complexity: entity.complexity,
      linesOfCode: entity.linesOfCode,
      lastModified: entity.lastModified.toISOString(),
    }
  }

  private mapToPattern(raw: RawPatternResult): Pattern {
    return {
      entity: raw.e,
      relations: raw.relations.map(r => ({
        type: r.type,
        target: r.node,
      })),
    }
  }

  private mapToDependency(raw: RawDependencyResult): Dependency {
    return {
      path: raw.nodeIds,
      relationTypes: raw.relationTypes,
      depth: raw.depth,
    }
  }

  private calculateRiskLevel(direct: number, indirect: number): RiskLevel {
    const total = direct * 2 + indirect
    if (total > 20) return 'critical'
    if (total > 10) return 'high'
    if (total > 5) return 'medium'
    return 'low'
  }
}
```

#### 1.1.3 타입 정의

```typescript
// src/infrastructure/knowledge/neo4j/types.ts

export type EntityType = 'File' | 'Class' | 'Method' | 'Function' | 'Variable' | 'Interface'

export type RelationType =
  | 'CONTAINS'
  | 'DEPENDS_ON'
  | 'IMPORTS'
  | 'CALLS'
  | 'EXTENDS'
  | 'IMPLEMENTS'
  | 'USES'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface CodeEntity {
  id: string
  type: EntityType
  name: string
  path: string
  language: string
  signature?: string
  docstring?: string
  complexity?: number
  linesOfCode?: number
  lastModified: Date
}

export interface CodePattern {
  entityType: EntityType
  name: string
  signature?: string
}

export interface Pattern {
  entity: CodeEntity
  relations: Array<{
    type: RelationType
    target: CodeEntity
  }>
}

export interface Dependency {
  path: string[]
  relationTypes: RelationType[]
  depth: number
}

export interface ImpactedEntity {
  id: string
  type: EntityType
  impactType: 'direct' | 'indirect'
}

export interface ImpactReport {
  entityId: string
  directImpact: ImpactedEntity[]
  indirectImpact: ImpactedEntity[]
  totalAffected: number
  riskLevel: RiskLevel
}
```

---

### 1.2 Vector Store

#### 1.2.1 파일 구조
```
src/infrastructure/knowledge/vector/
├── vector-store.ts        # 메인 스토어
├── embedder.ts            # 임베딩 서비스
├── providers/
│   ├── pinecone.ts        # Pinecone 구현
│   └── qdrant.ts          # Qdrant 구현
├── types.ts               # 타입 정의
└── index.ts               # 공개 API
```

#### 1.2.2 VectorStore 클래스

```typescript
// src/infrastructure/knowledge/vector/vector-store.ts

import { Pinecone } from '@pinecone-database/pinecone'

interface VectorStoreConfig {
  provider: 'pinecone' | 'qdrant'
  apiKey: string
  indexName: string
  dimension: number
  metric?: 'cosine' | 'euclidean' | 'dotProduct'
}

interface VectorItem {
  id: string
  embedding: number[]
  metadata: Record<string, unknown>
}

interface SearchResult {
  id: string
  score: number
  metadata: Record<string, unknown>
}

interface FilterCondition {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in'
  value: unknown
}

export class VectorStore {
  private client: Pinecone
  private index: any
  private config: VectorStoreConfig

  constructor(config: VectorStoreConfig) {
    this.config = {
      metric: 'cosine',
      ...config,
    }
  }

  /**
   * 벡터 스토어 초기화
   */
  async initialize(): Promise<void> {
    this.client = new Pinecone({
      apiKey: this.config.apiKey,
    })

    // 인덱스 존재 확인 및 생성
    const indexes = await this.client.listIndexes()
    const indexExists = indexes.indexes?.some(i => i.name === this.config.indexName)

    if (!indexExists) {
      await this.client.createIndex({
        name: this.config.indexName,
        dimension: this.config.dimension,
        metric: this.config.metric,
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      })

      // 인덱스 준비 대기
      await this.waitForIndexReady()
    }

    this.index = this.client.Index(this.config.indexName)
  }

  /**
   * 단일 벡터 삽입/업데이트
   * @param id - 벡터 ID
   * @param embedding - 임베딩 벡터
   * @param metadata - 메타데이터
   */
  async upsert(
    id: string,
    embedding: number[],
    metadata: Record<string, unknown>
  ): Promise<void> {
    this.validateEmbedding(embedding)

    await this.index.upsert([
      {
        id,
        values: embedding,
        metadata,
      },
    ])
  }

  /**
   * 배치 벡터 삽입/업데이트
   * @param items - 벡터 아이템 배열
   * @param batchSize - 배치 크기 (기본 100)
   */
  async batchUpsert(items: VectorItem[], batchSize: number = 100): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize).map(item => ({
        id: item.id,
        values: item.embedding,
        metadata: item.metadata,
      }))

      await this.index.upsert(batch)
    }
  }

  /**
   * 벡터 삭제
   * @param ids - 삭제할 벡터 ID 배열
   */
  async delete(ids: string[]): Promise<void> {
    await this.index.deleteMany(ids)
  }

  /**
   * 벡터 유사도 검색
   * @param query - 쿼리 벡터
   * @param topK - 반환할 최대 결과 수
   * @param filter - 필터 조건
   */
  async search(
    query: number[],
    topK: number = 10,
    filter?: FilterCondition[]
  ): Promise<SearchResult[]> {
    this.validateEmbedding(query)

    const pineconeFilter = filter ? this.buildPineconeFilter(filter) : undefined

    const result = await this.index.query({
      vector: query,
      topK,
      includeMetadata: true,
      filter: pineconeFilter,
    })

    return result.matches.map((match: any) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata || {},
    }))
  }

  /**
   * 텍스트 기반 시맨틱 검색
   * @param text - 검색 텍스트
   * @param embedder - 임베딩 서비스
   * @param topK - 반환할 최대 결과 수
   * @param filter - 필터 조건
   */
  async searchByText(
    text: string,
    embedder: EmbeddingService,
    topK: number = 10,
    filter?: FilterCondition[]
  ): Promise<SearchResult[]> {
    const embedding = await embedder.embed(text)
    return this.search(embedding, topK, filter)
  }

  /**
   * 인덱스 통계 조회
   */
  async getStats(): Promise<IndexStats> {
    const stats = await this.index.describeIndexStats()

    return {
      totalVectors: stats.totalRecordCount || 0,
      dimension: this.config.dimension,
      indexFullness: stats.indexFullness || 0,
      namespaces: stats.namespaces || {},
    }
  }

  // Private helper methods

  private validateEmbedding(embedding: number[]): void {
    if (embedding.length !== this.config.dimension) {
      throw new ValidationError(
        `Embedding dimension mismatch: expected ${this.config.dimension}, got ${embedding.length}`
      )
    }
  }

  private buildPineconeFilter(conditions: FilterCondition[]): Record<string, unknown> {
    const filter: Record<string, unknown> = {}

    for (const condition of conditions) {
      switch (condition.operator) {
        case 'eq':
          filter[condition.field] = { $eq: condition.value }
          break
        case 'ne':
          filter[condition.field] = { $ne: condition.value }
          break
        case 'gt':
          filter[condition.field] = { $gt: condition.value }
          break
        case 'gte':
          filter[condition.field] = { $gte: condition.value }
          break
        case 'lt':
          filter[condition.field] = { $lt: condition.value }
          break
        case 'lte':
          filter[condition.field] = { $lte: condition.value }
          break
        case 'in':
          filter[condition.field] = { $in: condition.value }
          break
      }
    }

    return filter
  }

  private async waitForIndexReady(maxWaitMs: number = 60000): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      const description = await this.client.describeIndex(this.config.indexName)

      if (description.status?.ready) {
        return
      }

      await delay(1000)
    }

    throw new TimeoutError('Index creation timed out')
  }
}
```

#### 1.2.3 Embedding Service

```typescript
// src/infrastructure/knowledge/vector/embedder.ts

import OpenAI from 'openai'

interface EmbeddingConfig {
  provider: 'openai' | 'anthropic' | 'local'
  model: string
  apiKey?: string
  batchSize?: number
}

export class EmbeddingService {
  private client: OpenAI
  private config: EmbeddingConfig

  constructor(config: EmbeddingConfig) {
    this.config = {
      batchSize: 100,
      ...config,
    }

    if (config.provider === 'openai') {
      this.client = new OpenAI({ apiKey: config.apiKey })
    }
  }

  /**
   * 단일 텍스트 임베딩
   * @param text - 임베딩할 텍스트
   */
  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.config.model,
      input: text,
    })

    return response.data[0].embedding
  }

  /**
   * 배치 텍스트 임베딩
   * @param texts - 임베딩할 텍스트 배열
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []

    for (let i = 0; i < texts.length; i += this.config.batchSize!) {
      const batch = texts.slice(i, i + this.config.batchSize!)

      const response = await this.client.embeddings.create({
        model: this.config.model,
        input: batch,
      })

      embeddings.push(...response.data.map(d => d.embedding))
    }

    return embeddings
  }

  /**
   * 코드 특화 임베딩
   * - 코드 구조 정보를 포함한 임베딩
   * @param code - 소스 코드
   * @param metadata - 코드 메타데이터
   */
  async embedCode(code: string, metadata: CodeMetadata): Promise<number[]> {
    // 코드 + 컨텍스트 정보를 결합한 텍스트 생성
    const enrichedText = this.buildCodeContext(code, metadata)
    return this.embed(enrichedText)
  }

  private buildCodeContext(code: string, metadata: CodeMetadata): string {
    const parts = [
      `Language: ${metadata.language}`,
      `Type: ${metadata.entityType}`,
      `Name: ${metadata.name}`,
    ]

    if (metadata.signature) {
      parts.push(`Signature: ${metadata.signature}`)
    }

    if (metadata.docstring) {
      parts.push(`Documentation: ${metadata.docstring}`)
    }

    parts.push(`Code:\n${code}`)

    return parts.join('\n')
  }
}
```

---

### 1.3 Feature Reuse Engine

#### 1.3.1 FeatureReuseEngine 클래스

```typescript
// src/infrastructure/knowledge/feature-reuse.ts

interface FeatureReuseConfig {
  similarityThreshold: number
  maxResults: number
  indexBatchSize: number
}

interface ReusableCode {
  filePath: string
  startLine: number
  endLine: number
  code: string
  entityName: string
  entityType: EntityType
  similarity: number
  adaptationHints: string[]
}

interface DuplicateGroup {
  hash: string
  instances: Array<{
    filePath: string
    startLine: number
    endLine: number
    code: string
  }>
  similarity: number
}

export class FeatureReuseEngine {
  private neo4j: Neo4jClient
  private vectorStore: VectorStore
  private embedder: EmbeddingService
  private config: FeatureReuseConfig

  constructor(
    neo4j: Neo4jClient,
    vectorStore: VectorStore,
    embedder: EmbeddingService,
    config: Partial<FeatureReuseConfig> = {}
  ) {
    this.neo4j = neo4j
    this.vectorStore = vectorStore
    this.embedder = embedder
    this.config = {
      similarityThreshold: 0.8,
      maxResults: 10,
      indexBatchSize: 50,
      ...config,
    }
  }

  /**
   * 코드베이스 인덱싱
   * @param projectPath - 프로젝트 루트 경로
   */
  async indexCodebase(projectPath: string): Promise<IndexingResult> {
    const parser = new CodeParser()
    const files = await this.scanSourceFiles(projectPath)

    let entitiesIndexed = 0
    let filesProcessed = 0

    for (const file of files) {
      try {
        const entities = await parser.parseFile(file)

        // Neo4j에 엔티티 저장
        for (const entity of entities) {
          await this.neo4j.storeEntity(entity)

          // 관계 생성
          for (const dep of entity.dependencies) {
            await this.neo4j.createRelation(entity.id, dep.id, dep.type)
          }
        }

        // Vector DB에 임베딩 저장
        const vectorItems = await this.createVectorItems(entities)
        await this.vectorStore.batchUpsert(vectorItems, this.config.indexBatchSize)

        entitiesIndexed += entities.length
        filesProcessed++
      } catch (error) {
        console.error(`Failed to index ${file}:`, error)
      }
    }

    return {
      filesProcessed,
      entitiesIndexed,
      duration: /* calculate */,
    }
  }

  /**
   * 요구사항에 맞는 재사용 가능 코드 검색
   * @param requirement - 자연어 요구사항
   */
  async findReusableCode(requirement: string): Promise<ReusableCode[]> {
    // 1. 요구사항 임베딩
    const embedding = await this.embedder.embed(requirement)

    // 2. 벡터 유사도 검색
    const vectorResults = await this.vectorStore.search(
      embedding,
      this.config.maxResults * 2,
      [{ field: 'entityType', operator: 'in', value: ['Method', 'Function', 'Class'] }]
    )

    // 3. 임계값 이상 필터링
    const filteredResults = vectorResults.filter(
      r => r.score >= this.config.similarityThreshold
    )

    // 4. 그래프 데이터로 보강
    const enrichedResults = await Promise.all(
      filteredResults.map(async result => {
        const graphData = await this.neo4j.query<CodeEntity>(
          `MATCH (e {id: $id}) RETURN e`,
          { id: result.id }
        )

        const entity = graphData[0]
        const code = await this.readCodeFromFile(entity)
        const adaptationHints = await this.generateAdaptationHints(
          requirement,
          entity,
          code
        )

        return {
          filePath: entity.path,
          startLine: entity.startLine,
          endLine: entity.endLine,
          code,
          entityName: entity.name,
          entityType: entity.type,
          similarity: result.score,
          adaptationHints,
        }
      })
    )

    // 5. 유사도 순 정렬 및 제한
    return enrichedResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.config.maxResults)
  }

  /**
   * 유사 구현 검색
   * @param code - 검색 기준 코드
   */
  async findSimilarImplementations(code: string): Promise<SimilarCode[]> {
    const embedding = await this.embedder.embed(code)
    const results = await this.vectorStore.search(embedding, this.config.maxResults)

    return results.map(r => ({
      id: r.id,
      similarity: r.score,
      metadata: r.metadata,
    }))
  }

  /**
   * 중복 코드 탐지
   * @param threshold - 유사도 임계값 (기본 0.9)
   */
  async detectDuplicates(threshold: number = 0.9): Promise<DuplicateGroup[]> {
    // 모든 메서드/함수 조회
    const entities = await this.neo4j.query<CodeEntity>(
      `MATCH (e) WHERE e.type IN ['Method', 'Function'] RETURN e`
    )

    const groups: Map<string, DuplicateGroup> = new Map()

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      const embedding = await this.getStoredEmbedding(entity.id)

      // 자신과 유사한 코드 검색
      const similar = await this.vectorStore.search(embedding, 10)

      for (const match of similar) {
        if (match.id === entity.id) continue
        if (match.score < threshold) continue

        // 그룹 생성 또는 추가
        const groupKey = this.generateGroupKey(entity.id, match.id)

        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            hash: groupKey,
            instances: [],
            similarity: match.score,
          })
        }

        const group = groups.get(groupKey)!
        if (!group.instances.find(i => i.filePath === entity.path)) {
          const code = await this.readCodeFromFile(entity)
          group.instances.push({
            filePath: entity.path,
            startLine: entity.startLine,
            endLine: entity.endLine,
            code,
          })
        }
      }
    }

    return Array.from(groups.values()).filter(g => g.instances.length > 1)
  }

  /**
   * 리팩토링 제안 생성
   * @param duplicates - 중복 그룹 배열
   */
  async suggestRefactoring(duplicates: DuplicateGroup[]): Promise<RefactoringSuggestion[]> {
    return duplicates.map(group => {
      const instances = group.instances

      // 공통 코드 추출
      const commonCode = this.extractCommonCode(instances.map(i => i.code))

      // 차이점 분석
      const differences = this.analyzeDifferences(instances.map(i => i.code))

      return {
        type: 'extract_common',
        description: `Extract common code from ${instances.length} locations`,
        affectedFiles: instances.map(i => i.filePath),
        commonCode,
        differences,
        estimatedImpact: this.estimateRefactoringImpact(instances),
      }
    })
  }

  // Private helper methods

  private async scanSourceFiles(projectPath: string): Promise<string[]> {
    const glob = require('glob')
    const patterns = ['**/*.ts', '**/*.js', '**/*.py', '**/*.java']

    const files: string[] = []
    for (const pattern of patterns) {
      const matches = await glob.glob(pattern, {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      })
      files.push(...matches.map(f => path.join(projectPath, f)))
    }

    return files
  }

  private async createVectorItems(entities: CodeEntity[]): Promise<VectorItem[]> {
    const items: VectorItem[] = []

    for (const entity of entities) {
      const code = await this.readCodeFromFile(entity)
      const embedding = await this.embedder.embedCode(code, {
        language: entity.language,
        entityType: entity.type,
        name: entity.name,
        signature: entity.signature,
        docstring: entity.docstring,
      })

      items.push({
        id: entity.id,
        embedding,
        metadata: {
          entityType: entity.type,
          name: entity.name,
          path: entity.path,
          language: entity.language,
        },
      })
    }

    return items
  }

  private async generateAdaptationHints(
    requirement: string,
    entity: CodeEntity,
    code: string
  ): Promise<string[]> {
    // LLM을 사용하여 적응 힌트 생성 (간단한 구현)
    const hints: string[] = []

    // 이름 변경 제안
    if (!requirement.toLowerCase().includes(entity.name.toLowerCase())) {
      hints.push(`Consider renaming '${entity.name}' to match your use case`)
    }

    // 파라미터 조정 제안
    if (entity.signature) {
      hints.push('Review parameters and adjust types as needed')
    }

    // 의존성 확인 제안
    const deps = await this.neo4j.findDependencies(entity.id, 1)
    if (deps.length > 0) {
      hints.push(`This code has ${deps.length} dependencies that may need to be imported`)
    }

    return hints
  }

  private async readCodeFromFile(entity: CodeEntity): Promise<string> {
    const content = await fs.readFile(entity.path, 'utf-8')
    const lines = content.split('\n')
    return lines.slice(entity.startLine - 1, entity.endLine).join('\n')
  }

  private generateGroupKey(id1: string, id2: string): string {
    return [id1, id2].sort().join(':')
  }

  private extractCommonCode(codes: string[]): string {
    // 간단한 LCS 기반 공통 코드 추출
    // 실제로는 더 정교한 알고리즘 사용
    return codes[0]
  }

  private analyzeDifferences(codes: string[]): Difference[] {
    // diff 분석
    return []
  }

  private estimateRefactoringImpact(instances: DuplicateGroup['instances']): Impact {
    return {
      linesReduced: instances.length * (instances[0].endLine - instances[0].startLine),
      filesAffected: instances.length,
      riskLevel: instances.length > 5 ? 'medium' : 'low',
    }
  }
}
```

---

## 2. Document Generator Implementation

### 2.1 HLD Generator

```typescript
// src/core/documents/hld-generator.ts

interface HLDGeneratorConfig {
  llmProvider: LLMProvider
  templatePath?: string
}

export class HLDGenerator {
  private llm: LLMProvider
  private templateEngine: TemplateEngine

  constructor(config: HLDGeneratorConfig) {
    this.llm = config.llmProvider
    this.templateEngine = new TemplateEngine(config.templatePath)
  }

  /**
   * 요구사항으로부터 HLD 생성
   * @param requirements - 구조화된 요구사항
   * @param context - 프로젝트 컨텍스트
   */
  async generate(
    requirements: Requirement[],
    context: ProjectContext
  ): Promise<HLDDocument> {
    // 1. 요구사항 분석
    const analysis = await this.analyzeRequirements(requirements)

    // 2. 아키텍처 타입 결정
    const architectureType = await this.determineArchitectureType(analysis, context)

    // 3. 기술 스택 선택
    const techStack = await this.selectTechStack(analysis, architectureType, context)

    // 4. 시스템 구조 설계
    const systemStructure = await this.designSystemStructure(analysis, architectureType)

    // 5. NFR 분석
    const nfr = await this.analyzeNFR(requirements, systemStructure)

    // 6. 리스크 평가
    const risks = await this.assessRisks(systemStructure, techStack)

    // 7. 공수 추정
    const effort = await this.estimateEffort(analysis, systemStructure)

    // 8. HLD 문서 조립
    return this.assembleHLD({
      analysis,
      architectureType,
      techStack,
      systemStructure,
      nfr,
      risks,
      effort,
    })
  }

  private async analyzeRequirements(requirements: Requirement[]): Promise<RequirementAnalysis> {
    const prompt = `
      Analyze the following requirements and extract:
      1. Functional requirements grouped by domain
      2. Key entities and their relationships
      3. Critical use cases
      4. Integration points

      Requirements:
      ${JSON.stringify(requirements, null, 2)}

      Respond in JSON format:
      {
        "domains": [...],
        "entities": [...],
        "useCases": [...],
        "integrations": [...]
      }
    `

    const response = await this.llm.chat([{ role: 'user', content: prompt }], {
      temperature: 0.2,
      maxTokens: 4000,
    })

    return JSON.parse(response.message.content)
  }

  private async determineArchitectureType(
    analysis: RequirementAnalysis,
    context: ProjectContext
  ): Promise<ArchitectureType> {
    // 결정 기준:
    // - 도메인 복잡도
    // - 확장성 요구사항
    // - 팀 규모
    // - 배포 유연성 요구

    const factors = {
      domainCount: analysis.domains.length,
      entityCount: analysis.entities.length,
      hasHighScalability: context.nfr?.scalability === 'high',
      teamSize: context.teamSize || 1,
      independentDeployment: context.deploymentRequirements?.independent || false,
    }

    if (factors.domainCount > 5 || factors.independentDeployment) {
      return 'microservices'
    } else if (factors.hasHighScalability && factors.teamSize < 3) {
      return 'serverless'
    } else if (factors.domainCount <= 3) {
      return 'monolith'
    }

    return 'hybrid'
  }

  private async selectTechStack(
    analysis: RequirementAnalysis,
    archType: ArchitectureType,
    context: ProjectContext
  ): Promise<TechStackDecision[]> {
    const prompt = `
      Select technology stack for a ${archType} system with:
      - Domains: ${analysis.domains.map(d => d.name).join(', ')}
      - Key entities: ${analysis.entities.map(e => e.name).join(', ')}
      - Team preference: ${context.preferences?.languages?.join(', ') || 'any'}
      - Budget: ${context.budget || 'moderate'}

      For each category (language, framework, database, messaging, cloud),
      provide the recommended choice with rationale.

      Respond in JSON format:
      [{
        "category": "...",
        "choice": "...",
        "alternatives": [...],
        "rationale": "...",
        "tradeoffs": [{"pro": "...", "con": "..."}]
      }]
    `

    const response = await this.llm.chat([{ role: 'user', content: prompt }], {
      temperature: 0.3,
      maxTokens: 2000,
    })

    return JSON.parse(response.message.content)
  }

  private async designSystemStructure(
    analysis: RequirementAnalysis,
    archType: ArchitectureType
  ): Promise<SystemStructure> {
    const prompt = `
      Design system structure for a ${archType} architecture:

      Domains:
      ${JSON.stringify(analysis.domains, null, 2)}

      Create:
      1. Component breakdown with responsibilities
      2. Data flow between components
      3. External integrations
      4. System diagram in Mermaid format

      Respond in JSON format:
      {
        "components": [...],
        "dataFlow": [...],
        "integrations": [...],
        "diagram": "mermaid diagram string"
      }
    `

    const response = await this.llm.chat([{ role: 'user', content: prompt }], {
      temperature: 0.2,
      maxTokens: 4000,
    })

    return JSON.parse(response.message.content)
  }

  private async analyzeNFR(
    requirements: Requirement[],
    structure: SystemStructure
  ): Promise<NFRSpec> {
    // 비기능 요구사항 추출 및 분석
    const nfrRequirements = requirements.filter(r => r.type === 'non-functional')

    return {
      performance: this.extractPerformanceNFR(nfrRequirements, structure),
      scalability: this.extractScalabilityNFR(nfrRequirements, structure),
      security: this.extractSecurityNFR(nfrRequirements, structure),
      availability: this.extractAvailabilityNFR(nfrRequirements, structure),
      maintainability: this.extractMaintainabilityNFR(nfrRequirements, structure),
    }
  }

  private async assessRisks(
    structure: SystemStructure,
    techStack: TechStackDecision[]
  ): Promise<Risk[]> {
    const risks: Risk[] = []

    // 기술 리스크 평가
    for (const tech of techStack) {
      if (tech.maturity === 'emerging') {
        risks.push({
          category: 'technical',
          description: `${tech.choice} is an emerging technology`,
          probability: 'medium',
          impact: 'medium',
          mitigation: 'Prepare fallback option and team training',
        })
      }
    }

    // 아키텍처 리스크 평가
    if (structure.components.length > 10) {
      risks.push({
        category: 'complexity',
        description: 'High number of components increases integration complexity',
        probability: 'high',
        impact: 'medium',
        mitigation: 'Implement comprehensive integration testing',
      })
    }

    return risks
  }

  private async estimateEffort(
    analysis: RequirementAnalysis,
    structure: SystemStructure
  ): Promise<EffortEstimate> {
    // 기본 추정 공식
    const basePoints = analysis.useCases.length * 3
    const complexityMultiplier = this.calculateComplexityMultiplier(structure)
    const integrationOverhead = analysis.integrations.length * 5

    const totalPoints = Math.ceil(
      (basePoints + integrationOverhead) * complexityMultiplier
    )

    return {
      storyPoints: totalPoints,
      estimatedDays: Math.ceil(totalPoints / 8), // 하루 8포인트 기준
      breakdown: {
        development: Math.ceil(totalPoints * 0.5),
        testing: Math.ceil(totalPoints * 0.25),
        integration: Math.ceil(totalPoints * 0.15),
        documentation: Math.ceil(totalPoints * 0.1),
      },
      confidence: this.calculateConfidence(analysis),
    }
  }

  private calculateComplexityMultiplier(structure: SystemStructure): number {
    let multiplier = 1.0

    if (structure.components.length > 5) multiplier += 0.2
    if (structure.components.length > 10) multiplier += 0.3
    if (structure.integrations.length > 3) multiplier += 0.1

    return multiplier
  }

  private calculateConfidence(analysis: RequirementAnalysis): number {
    // 요구사항 명확성에 따른 신뢰도
    let confidence = 0.8

    if (analysis.domains.some(d => d.unclear)) confidence -= 0.1
    if (analysis.useCases.length < 5) confidence -= 0.1
    if (analysis.integrations.some(i => i.undefined)) confidence -= 0.15

    return Math.max(0.3, confidence)
  }

  private assembleHLD(components: HLDComponents): HLDDocument {
    return {
      id: crypto.randomUUID(),
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),

      projectName: components.analysis.projectName,
      projectDescription: components.analysis.description,
      objectives: components.analysis.objectives,
      scope: components.analysis.scope,
      constraints: components.analysis.constraints,

      architectureType: components.architectureType,
      systemDiagram: components.systemStructure.diagram,
      components: components.systemStructure.components,
      dataFlow: components.systemStructure.dataFlow,

      technologyStack: components.techStack,
      nfr: components.nfr,
      risks: components.risks,
      mitigations: components.risks.map(r => r.mitigation),

      estimatedEffort: components.effort,
      timeline: this.generateTimeline(components.effort),
    }
  }

  private generateTimeline(effort: EffortEstimate): Milestone[] {
    const phases = [
      { name: 'Design', ratio: 0.15 },
      { name: 'Development', ratio: 0.50 },
      { name: 'Testing', ratio: 0.25 },
      { name: 'Deployment', ratio: 0.10 },
    ]

    let currentDay = 0
    return phases.map(phase => {
      const phaseDays = Math.ceil(effort.estimatedDays * phase.ratio)
      const milestone: Milestone = {
        name: phase.name,
        startDay: currentDay,
        endDay: currentDay + phaseDays,
        deliverables: this.getPhaseDeliverables(phase.name),
      }
      currentDay += phaseDays
      return milestone
    })
  }

  private getPhaseDeliverables(phase: string): string[] {
    const deliverables: Record<string, string[]> = {
      Design: ['HLD Document', 'MLD Documents', 'API Specifications'],
      Development: ['Source Code', 'Unit Tests', 'Documentation'],
      Testing: ['Test Reports', 'Bug Fixes', 'Performance Reports'],
      Deployment: ['Deployment Scripts', 'Runbook', 'Monitoring Setup'],
    }
    return deliverables[phase] || []
  }
}
```

---

## 3. Agent Implementation Details

### 3.1 Base Agent Enhancement

```typescript
// src/agents/base/base-agent-enhanced.ts

import { EventEmitter } from 'events'

export abstract class EnhancedBaseAgent extends EventEmitter {
  protected id: string
  protected config: AgentConfig
  protected state: AgentState = 'idle'
  protected currentTask: Task | null = null
  protected metrics: AgentMetrics

  // Injected dependencies
  protected llm: LLMProvider
  protected eventBus: EventEmitter
  protected logger: Logger
  protected knowledgeManager: KnowledgeManager

  constructor(config: AgentConfig, dependencies: AgentDependencies) {
    super()
    this.id = config.id || crypto.randomUUID()
    this.config = config
    this.llm = dependencies.llmProvider
    this.eventBus = dependencies.eventBus
    this.logger = dependencies.logger
    this.knowledgeManager = dependencies.knowledgeManager

    this.metrics = this.initializeMetrics()
  }

  /**
   * 에이전트 초기화
   */
  async initialize(): Promise<void> {
    this.logger.info(`Initializing agent ${this.id}`)
    await this.registerWithEventBus()
    await this.loadContext()
    this.setState('idle')
  }

  /**
   * 태스크 실행 (템플릿 메서드)
   */
  async executeTask(task: Task): Promise<TaskResult> {
    this.validateTaskType(task)

    const startTime = Date.now()
    this.currentTask = task
    this.setState('busy')

    this.eventBus.emit('task.started', {
      agentId: this.id,
      taskId: task.id,
      timestamp: new Date(),
    })

    try {
      // Pre-execution hooks
      await this.beforeExecution(task)

      // Main execution (implemented by subclasses)
      const result = await this.doExecute(task)

      // Post-execution hooks
      await this.afterExecution(task, result)

      // Update metrics
      this.updateMetrics('success', Date.now() - startTime)

      this.eventBus.emit('task.completed', {
        agentId: this.id,
        taskId: task.id,
        result,
        duration: Date.now() - startTime,
      })

      return result
    } catch (error) {
      // Error handling
      const handledError = await this.handleError(error, task)

      this.updateMetrics('failure', Date.now() - startTime)

      this.eventBus.emit('task.failed', {
        agentId: this.id,
        taskId: task.id,
        error: handledError,
      })

      throw handledError
    } finally {
      this.currentTask = null
      this.setState('idle')
    }
  }

  /**
   * 헬스 체크
   */
  getHealth(): HealthStatus {
    return {
      agentId: this.id,
      state: this.state,
      currentTask: this.currentTask?.id,
      metrics: this.metrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      lastActivity: this.metrics.lastActivityAt,
    }
  }

  /**
   * 컨텍스트 조회 (지식 그래프 활용)
   */
  protected async queryKnowledge(query: KnowledgeQuery): Promise<KnowledgeResult> {
    return this.knowledgeManager.query(query)
  }

  /**
   * 유사 구현 검색
   */
  protected async findSimilarImplementations(spec: Specification): Promise<SimilarCode[]> {
    return this.knowledgeManager.findSimilar(spec.description)
  }

  /**
   * LLM 호출 (공통)
   */
  protected async callLLM(
    prompt: string,
    options: LLMCallOptions = {}
  ): Promise<LLMResponse> {
    const startTime = Date.now()

    try {
      const response = await this.llm.chat(
        [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        {
          temperature: options.temperature ?? 0.2,
          maxTokens: options.maxTokens ?? 4000,
          ...options,
        }
      )

      // 토큰 사용량 추적
      this.metrics.totalTokens += response.usage.promptTokens + response.usage.completionTokens

      return response
    } catch (error) {
      this.logger.error(`LLM call failed: ${error.message}`)
      throw new LLMError(error.message, error)
    }
  }

  // Abstract methods (implemented by subclasses)
  protected abstract getSystemPrompt(): string
  protected abstract doExecute(task: Task): Promise<TaskResult>
  protected abstract validateTaskType(task: Task): void

  // Hooks (can be overridden)
  protected async beforeExecution(task: Task): Promise<void> {}
  protected async afterExecution(task: Task, result: TaskResult): Promise<void> {}

  // Private methods
  private setState(state: AgentState): void {
    const previousState = this.state
    this.state = state
    this.emit('stateChange', { from: previousState, to: state })
  }

  private async registerWithEventBus(): Promise<void> {
    this.eventBus.on(`agent.${this.id}.task`, async (task: Task) => {
      await this.executeTask(task)
    })
  }

  private async loadContext(): Promise<void> {
    // Load agent-specific context from knowledge manager
  }

  private initializeMetrics(): AgentMetrics {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageExecutionTime: 0,
      totalTokens: 0,
      lastActivityAt: new Date(),
    }
  }

  private updateMetrics(status: 'success' | 'failure', duration: number): void {
    if (status === 'success') {
      this.metrics.tasksCompleted++
    } else {
      this.metrics.tasksFailed++
    }

    // 이동 평균 업데이트
    const totalTasks = this.metrics.tasksCompleted + this.metrics.tasksFailed
    this.metrics.averageExecutionTime =
      (this.metrics.averageExecutionTime * (totalTasks - 1) + duration) / totalTasks

    this.metrics.lastActivityAt = new Date()
  }

  private async handleError(error: Error, task: Task): Promise<Error> {
    this.logger.error(`Task ${task.id} failed: ${error.message}`, {
      stack: error.stack,
      taskType: task.type,
    })

    // 에러 분류 및 처리
    if (error instanceof TransientError) {
      // 일시적 에러는 재시도 가능으로 표시
      return new RetryableError(error.message, error)
    }

    return error
  }
}
```

### 3.2 Coder Agent Implementation

```typescript
// src/agents/coder/coder-agent-impl.ts

export class CoderAgentImpl extends EnhancedBaseAgent {
  private codeParser: CodeParser
  private syntaxValidator: SyntaxValidator
  private gitService: GitService

  constructor(config: AgentConfig, dependencies: AgentDependencies) {
    super(config, dependencies)
    this.codeParser = new CodeParser()
    this.syntaxValidator = new SyntaxValidator()
    this.gitService = dependencies.gitService
  }

  protected getSystemPrompt(): string {
    return `You are an expert software developer.
Your task is to generate high-quality, production-ready code.

Guidelines:
- Follow the provided specifications exactly
- Write clean, readable code with proper naming conventions
- Include necessary error handling
- Add JSDoc/docstring comments for public APIs
- Follow language-specific best practices
- Consider edge cases and validation

Output format:
- Return only the code without markdown code blocks
- Include imports at the top
- Organize code logically
`
  }

  protected validateTaskType(task: Task): void {
    if (!['code_generation', 'code_modification', 'bug_fix'].includes(task.type)) {
      throw new InvalidTaskTypeError(`Coder agent cannot handle task type: ${task.type}`)
    }
  }

  protected async doExecute(task: Task): Promise<CodeTaskResult> {
    switch (task.type) {
      case 'code_generation':
        return this.generateCode(task)
      case 'code_modification':
        return this.modifyCode(task)
      case 'bug_fix':
        return this.fixBug(task)
      default:
        throw new InvalidTaskTypeError(task.type)
    }
  }

  /**
   * LLD 기반 코드 생성
   */
  async generateFromLLD(lld: LLDDocument): Promise<GeneratedCode> {
    const files: GeneratedFile[] = []

    // 클래스 생성
    const classCode = await this.generateClass(lld)
    files.push(classCode)

    // 테스트 생성
    if (this.config.generateTests) {
      const testCode = await this.generateTests(classCode)
      files.push(testCode)
    }

    // 문법 검증
    for (const file of files) {
      const validation = await this.syntaxValidator.validate(file.content, file.language)
      if (!validation.valid) {
        // 자동 수정 시도
        file.content = await this.autoFix(file.content, validation.errors)
      }
    }

    return { files }
  }

  private async generateCode(task: CodeGenerationTask): Promise<CodeTaskResult> {
    const { specification, context } = task.payload

    // 1. 유사 구현 검색
    const similarCode = await this.findSimilarImplementations(specification)

    // 2. 프롬프트 구성
    const prompt = this.buildGenerationPrompt(specification, context, similarCode)

    // 3. LLM 호출
    const response = await this.callLLM(prompt, {
      temperature: 0.2,
      maxTokens: 8000,
    })

    // 4. 코드 추출 및 검증
    const code = this.extractCode(response.message.content)
    const validation = await this.syntaxValidator.validate(code, specification.language)

    if (!validation.valid) {
      // 재생성 또는 자동 수정
      const fixedCode = await this.attemptAutoFix(code, validation.errors)
      return {
        success: true,
        code: fixedCode,
        files: [{ path: specification.outputPath, content: fixedCode }],
        validation: await this.syntaxValidator.validate(fixedCode, specification.language),
      }
    }

    return {
      success: true,
      code,
      files: [{ path: specification.outputPath, content: code }],
      validation,
    }
  }

  private async generateClass(lld: LLDDocument): Promise<GeneratedFile> {
    const prompt = `
Generate a TypeScript class based on the following Low-Level Design:

Class: ${lld.className}
${lld.classDefinition.extends ? `Extends: ${lld.classDefinition.extends}` : ''}
${lld.classDefinition.implements?.length ? `Implements: ${lld.classDefinition.implements.join(', ')}` : ''}

Properties:
${lld.properties.map(p => `- ${p.name}: ${p.type} (${p.visibility})`).join('\n')}

Methods:
${lld.methods.map(m => `
- ${m.name}(${m.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}): ${m.returnType}
  Description: ${m.description}
  ${m.algorithm ? `Algorithm: ${m.algorithm.pseudocode}` : ''}
`).join('\n')}

Implementation Notes:
${lld.implementationNotes.join('\n')}

Generate complete, production-ready code.
`

    const response = await this.callLLM(prompt, { maxTokens: 8000 })
    const code = this.extractCode(response.message.content)

    return {
      path: `src/${lld.className.toLowerCase()}.ts`,
      content: code,
      language: 'typescript',
    }
  }

  private async generateTests(classFile: GeneratedFile): Promise<GeneratedFile> {
    const prompt = `
Generate comprehensive unit tests for the following code:

${classFile.content}

Requirements:
- Use Jest testing framework
- Test all public methods
- Include edge cases
- Achieve at least 80% coverage
- Mock external dependencies
`

    const response = await this.callLLM(prompt, { maxTokens: 6000 })
    const testCode = this.extractCode(response.message.content)

    return {
      path: classFile.path.replace('.ts', '.test.ts'),
      content: testCode,
      language: 'typescript',
    }
  }

  private buildGenerationPrompt(
    spec: Specification,
    context: GenerationContext,
    similarCode: SimilarCode[]
  ): string {
    let prompt = `Generate code for the following specification:

${spec.description}

Requirements:
${spec.requirements.map(r => `- ${r}`).join('\n')}

Constraints:
${spec.constraints.map(c => `- ${c}`).join('\n')}
`

    if (context.existingCode) {
      prompt += `

Existing code context:
\`\`\`${spec.language}
${context.existingCode}
\`\`\`
`
    }

    if (similarCode.length > 0) {
      prompt += `

Reference implementations (for inspiration, not copying):
${similarCode.slice(0, 3).map((s, i) => `
Example ${i + 1} (similarity: ${(s.similarity * 100).toFixed(0)}%):
\`\`\`
${s.code}
\`\`\`
`).join('\n')}
`
    }

    return prompt
  }

  private extractCode(content: string): string {
    // 마크다운 코드 블록 제거
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g
    const matches = [...content.matchAll(codeBlockRegex)]

    if (matches.length > 0) {
      return matches.map(m => m[1]).join('\n\n')
    }

    return content.trim()
  }

  private async attemptAutoFix(code: string, errors: SyntaxError[]): Promise<string> {
    const prompt = `
Fix the following syntax errors in this code:

Code:
\`\`\`
${code}
\`\`\`

Errors:
${errors.map(e => `Line ${e.line}: ${e.message}`).join('\n')}

Return only the corrected code without explanations.
`

    const response = await this.callLLM(prompt, {
      temperature: 0.1,
      maxTokens: 8000,
    })

    return this.extractCode(response.message.content)
  }

  private async modifyCode(task: CodeModificationTask): Promise<CodeTaskResult> {
    const { filePath, modification, context } = task.payload

    // 기존 코드 읽기
    const existingCode = await fs.readFile(filePath, 'utf-8')

    const prompt = `
Modify the following code according to the specification:

Current code:
\`\`\`
${existingCode}
\`\`\`

Modification required:
${modification.description}

${modification.targetSection ? `Focus on this section: ${modification.targetSection}` : ''}

Return the complete modified code.
`

    const response = await this.callLLM(prompt, { maxTokens: 8000 })
    const modifiedCode = this.extractCode(response.message.content)

    return {
      success: true,
      code: modifiedCode,
      files: [{ path: filePath, content: modifiedCode }],
      diff: this.generateDiff(existingCode, modifiedCode),
    }
  }

  private async fixBug(task: BugFixTask): Promise<CodeTaskResult> {
    const { filePath, bugDescription, stackTrace, context } = task.payload

    const existingCode = await fs.readFile(filePath, 'utf-8')

    const prompt = `
Fix the bug in the following code:

Code:
\`\`\`
${existingCode}
\`\`\`

Bug description:
${bugDescription}

Stack trace:
${stackTrace}

Analyze the root cause and provide the fixed code.
Also explain what was wrong and how you fixed it.
`

    const response = await this.callLLM(prompt, { maxTokens: 8000 })

    // 응답에서 코드와 설명 분리
    const { code, explanation } = this.parseFixResponse(response.message.content)

    return {
      success: true,
      code,
      files: [{ path: filePath, content: code }],
      explanation,
      diff: this.generateDiff(existingCode, code),
    }
  }

  private generateDiff(oldCode: string, newCode: string): string {
    // diff 생성 (실제로는 diff 라이브러리 사용)
    return `--- old\n+++ new\n...`
  }

  private parseFixResponse(content: string): { code: string; explanation: string } {
    // 응답 파싱 로직
    const codeMatch = content.match(/```[\s\S]*?```/)
    const code = codeMatch ? this.extractCode(codeMatch[0]) : content

    const explanation = content.replace(/```[\s\S]*?```/g, '').trim()

    return { code, explanation }
  }
}
```

---

## 4. Orchestration Implementation

### 4.1 Task Router

```typescript
// src/core/orchestration/task-router.ts

interface TaskRouterConfig {
  loadBalancing: 'round-robin' | 'least-loaded' | 'capability-based'
  maxQueueSize: number
  timeout: number
}

export class TaskRouter {
  private agents: Map<string, EnhancedBaseAgent> = new Map()
  private taskQueue: PriorityQueue<Task>
  private config: TaskRouterConfig

  constructor(config: TaskRouterConfig) {
    this.config = config
    this.taskQueue = new PriorityQueue<Task>((a, b) =>
      this.comparePriority(a.priority, b.priority)
    )
  }

  /**
   * 에이전트 등록
   */
  registerAgent(agent: EnhancedBaseAgent): void {
    this.agents.set(agent.id, agent)

    // 에이전트 상태 변화 모니터링
    agent.on('stateChange', ({ from, to }) => {
      if (to === 'idle') {
        this.processQueue()
      }
    })
  }

  /**
   * 에이전트 제거
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId)
  }

  /**
   * 태스크 라우팅
   */
  async route(task: Task): Promise<TaskRoutingResult> {
    // 1. 태스크 분석
    const analysis = await this.analyzeTask(task)

    // 2. 적합한 에이전트 선택
    const agent = await this.selectAgent(task, analysis)

    if (!agent) {
      // 에이전트 없으면 큐에 추가
      if (this.taskQueue.size() >= this.config.maxQueueSize) {
        throw new QueueFullError('Task queue is full')
      }
      this.taskQueue.enqueue(task)
      return { queued: true, position: this.taskQueue.size() }
    }

    // 3. 태스크 할당
    return this.assignTask(task, agent)
  }

  private async analyzeTask(task: Task): Promise<TaskAnalysis> {
    return {
      type: task.type,
      complexity: this.estimateComplexity(task),
      requiredCapabilities: this.extractRequiredCapabilities(task),
      estimatedDuration: this.estimateDuration(task),
      dependencies: task.dependencies || [],
    }
  }

  private async selectAgent(
    task: Task,
    analysis: TaskAnalysis
  ): Promise<EnhancedBaseAgent | null> {
    const availableAgents = Array.from(this.agents.values()).filter(
      agent => agent.getHealth().state === 'idle'
    )

    if (availableAgents.length === 0) {
      return null
    }

    switch (this.config.loadBalancing) {
      case 'round-robin':
        return this.roundRobinSelect(availableAgents)

      case 'least-loaded':
        return this.leastLoadedSelect(availableAgents)

      case 'capability-based':
        return this.capabilityBasedSelect(availableAgents, analysis)

      default:
        return availableAgents[0]
    }
  }

  private roundRobinSelect(agents: EnhancedBaseAgent[]): EnhancedBaseAgent {
    // 간단한 라운드로빈
    return agents[0]
  }

  private leastLoadedSelect(agents: EnhancedBaseAgent[]): EnhancedBaseAgent {
    return agents.reduce((least, current) => {
      const leastMetrics = least.getHealth().metrics
      const currentMetrics = current.getHealth().metrics
      return currentMetrics.tasksCompleted < leastMetrics.tasksCompleted ? current : least
    })
  }

  private capabilityBasedSelect(
    agents: EnhancedBaseAgent[],
    analysis: TaskAnalysis
  ): EnhancedBaseAgent | null {
    // 능력 기반 매칭
    const scored = agents.map(agent => ({
      agent,
      score: this.calculateCapabilityScore(agent, analysis),
    }))

    scored.sort((a, b) => b.score - a.score)

    return scored[0]?.score > 0 ? scored[0].agent : null
  }

  private calculateCapabilityScore(
    agent: EnhancedBaseAgent,
    analysis: TaskAnalysis
  ): number {
    let score = 0

    // 타입 매칭
    if (agent.canHandle(analysis.type)) {
      score += 50
    }

    // 성공률 반영
    const metrics = agent.getHealth().metrics
    const successRate = metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed)
    score += successRate * 30

    // 복잡도 대응 능력
    if (analysis.complexity === 'high' && agent.config.specialization === 'complex') {
      score += 20
    }

    return score
  }

  private async assignTask(
    task: Task,
    agent: EnhancedBaseAgent
  ): Promise<TaskRoutingResult> {
    try {
      const result = await agent.executeTask(task)
      return { assigned: true, agentId: agent.id, result }
    } catch (error) {
      return { assigned: true, agentId: agent.id, error }
    }
  }

  private processQueue(): void {
    if (this.taskQueue.isEmpty()) return

    const task = this.taskQueue.peek()
    if (!task) return

    // 비동기로 처리
    setImmediate(async () => {
      const result = await this.route(task)
      if (result.assigned) {
        this.taskQueue.dequeue()
      }
    })
  }

  private estimateComplexity(task: Task): 'low' | 'medium' | 'high' {
    // 휴리스틱 기반 복잡도 추정
    const descLength = task.description?.length || 0
    const hasMultipleFiles = task.payload?.files?.length > 1

    if (descLength > 1000 || hasMultipleFiles) return 'high'
    if (descLength > 300) return 'medium'
    return 'low'
  }

  private extractRequiredCapabilities(task: Task): string[] {
    const capabilities: string[] = [task.type]

    // 태스크 내용에서 추가 능력 추출
    if (task.payload?.language) {
      capabilities.push(`language:${task.payload.language}`)
    }

    return capabilities
  }

  private estimateDuration(task: Task): number {
    const complexityMultiplier = {
      low: 1,
      medium: 2,
      high: 4,
    }

    const baseTime = 30000 // 30초
    const complexity = this.estimateComplexity(task)

    return baseTime * complexityMultiplier[complexity]
  }

  private comparePriority(a: Priority, b: Priority): number {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return priorityOrder[a] - priorityOrder[b]
  }
}
```

---

## 5. Summary - 구현 체크리스트

### Phase 1: Knowledge Layer
- [ ] `Neo4jClient` - 연결, 쿼리, 엔티티 저장
- [ ] `VectorStore` - 임베딩 저장/검색
- [ ] `EmbeddingService` - 텍스트/코드 임베딩
- [ ] `FeatureReuseEngine` - 인덱싱, 검색, 중복 탐지

### Phase 2: Document Generation
- [ ] `HLDGenerator` - 요구사항 → HLD
- [ ] `MLDGenerator` - HLD → MLD
- [ ] `LLDGenerator` - MLD → LLD
- [ ] `DocumentBuilder` - 문서 조립

### Phase 3: Agent Enhancement
- [ ] `EnhancedBaseAgent` - 공통 기반
- [ ] `CoderAgentImpl` - 코드 생성/수정
- [ ] `ReviewerAgentImpl` - 코드 리뷰
- [ ] `QAAgentImpl` - 테스트 생성/실행
- [ ] Executive Agents (CTO, PM, Architect)

### Phase 4: Orchestration
- [ ] `TaskRouter` - 태스크 라우팅
- [ ] `WorkflowEngine` - 워크플로우 실행
- [ ] `DAGExecutor` - DAG 기반 실행
- [ ] `EventBus` - 이벤트 발행/구독

### Phase 5: Operations
- [ ] `Supervisor` - 시스템 모니터링
- [ ] `CostMonitor` - 비용 추적
- [ ] `Scheduler` - 스케줄링
- [ ] Self-improvement 시스템
