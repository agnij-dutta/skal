import { ethers } from 'ethers'

export interface VerificationSubmission {
  verifier: string
  score: number
  signature: string
  timestamp: number
}

export interface ConsensusResult {
  hasConsensus: boolean
  finalScore: number | null
  submissionCount: number
  variance: number
  outliers: string[]
}

/**
 * ConsensusManager
 * Manages multi-oracle coordination and consensus detection
 */
export class ConsensusManager {
  private provider: ethers.JsonRpcProvider
  private aggregatorContract: ethers.Contract
  private consensusThreshold: number
  private scoreVarianceTolerance: number

  constructor(
    provider: ethers.JsonRpcProvider,
    aggregatorAddress: string,
    consensusThreshold: number = 2,
    scoreVarianceTolerance: number = 15
  ) {
    this.provider = provider
    this.consensusThreshold = consensusThreshold
    this.scoreVarianceTolerance = scoreVarianceTolerance
    
    const aggregatorABI = [
      'function getTaskSubmissions(uint256) external view returns (tuple(address verifier, uint8 score, bytes signature, uint256 timestamp, bool counted)[])',
      'function getSubmissionCount(uint256) external view returns (uint256)',
      'function hasConsensus(uint256) external view returns (bool)'
    ]
    
    this.aggregatorContract = new ethers.Contract(
      aggregatorAddress,
      aggregatorABI,
      provider
    )
  }

  /**
   * Collect all submissions for a task
   */
  async collectSubmissions(taskId: number): Promise<VerificationSubmission[]> {
    try {
      const submissions = await this.aggregatorContract.getTaskSubmissions(taskId)
      
      return submissions.map((sub: any) => ({
        verifier: sub.verifier,
        score: Number(sub.score),
        signature: sub.signature,
        timestamp: Number(sub.timestamp)
      }))
    } catch (error) {
      console.error(`Failed to collect submissions for task ${taskId}:`, error)
      return []
    }
  }

  /**
   * Detect if consensus has been reached
   */
  async detectConsensus(submissions: VerificationSubmission[]): Promise<boolean> {
    if (submissions.length < this.consensusThreshold) {
      return false
    }

    // Calculate median score
    const medianScore = this.calculateMedian(submissions.map(s => s.score))
    
    // Count how many scores are within tolerance of median
    const tolerance = (medianScore * this.scoreVarianceTolerance) / 100
    let consensusCount = 0

    for (const submission of submissions) {
      const diff = Math.abs(submission.score - medianScore)
      if (diff <= tolerance) {
        consensusCount++
      }
    }

    return consensusCount >= this.consensusThreshold
  }

  /**
   * Aggregate scores from multiple submissions
   */
  async aggregateScores(submissions: VerificationSubmission[]): Promise<number> {
    if (submissions.length === 0) {
      throw new Error('No submissions to aggregate')
    }

    // Use median as the aggregated score (more robust to outliers)
    const scores = submissions.map(s => s.score)
    return Math.round(this.calculateMedian(scores))
  }

  /**
   * Analyze consensus and identify outliers
   */
  async analyzeConsensus(taskId: number): Promise<ConsensusResult> {
    const submissions = await this.collectSubmissions(taskId)
    
    if (submissions.length === 0) {
      return {
        hasConsensus: false,
        finalScore: null,
        submissionCount: 0,
        variance: 0,
        outliers: []
      }
    }

    const hasConsensus = await this.detectConsensus(submissions)
    const finalScore = hasConsensus ? await this.aggregateScores(submissions) : null
    const variance = this.calculateVariance(submissions.map(s => s.score))
    const outliers = this.identifyOutliers(submissions)

    return {
      hasConsensus,
      finalScore,
      submissionCount: submissions.length,
      variance,
      outliers: outliers.map(o => o.verifier)
    }
  }

  /**
   * Handle dispute resolution
   */
  async handleDispute(taskId: number, submissions: VerificationSubmission[]): Promise<{
    shouldSlash: string[]
    reason: string
  }> {
    const medianScore = this.calculateMedian(submissions.map(s => s.score))
    const tolerance = (medianScore * this.scoreVarianceTolerance) / 100
    const shouldSlash: string[] = []

    // Identify oracles with scores significantly far from consensus
    for (const submission of submissions) {
      const diff = Math.abs(submission.score - medianScore)
      
      // Slash if deviation is more than 3x tolerance
      if (diff > tolerance * 3) {
        shouldSlash.push(submission.verifier)
      }
    }

    const reason = shouldSlash.length > 0
      ? `Score significantly deviates from consensus (median: ${medianScore})`
      : 'No slashing required'

    return { shouldSlash, reason }
  }

  /**
   * Get consensus status for a task
   */
  async getConsensusStatus(taskId: number): Promise<{
    ready: boolean
    submissionCount: number
    needsMore: number
    hasConsensus: boolean
  }> {
    try {
      const submissionCount = Number(await this.aggregatorContract.getSubmissionCount(taskId))
      const hasConsensus = await this.aggregatorContract.hasConsensus(taskId)
      
      const needsMore = Math.max(0, this.consensusThreshold - submissionCount)
      const ready = submissionCount >= this.consensusThreshold || hasConsensus

      return {
        ready,
        submissionCount,
        needsMore,
        hasConsensus
      }
    } catch (error) {
      console.error(`Failed to get consensus status for task ${taskId}:`, error)
      return {
        ready: false,
        submissionCount: 0,
        needsMore: this.consensusThreshold,
        hasConsensus: false
      }
    }
  }

  /**
   * Predict consensus based on current submissions
   */
  predictConsensus(submissions: VerificationSubmission[]): {
    likelyScore: number
    confidence: number
    needsMoreSubmissions: boolean
  } {
    if (submissions.length === 0) {
      return {
        likelyScore: 0,
        confidence: 0,
        needsMoreSubmissions: true
      }
    }

    const medianScore = this.calculateMedian(submissions.map(s => s.score))
    const variance = this.calculateVariance(submissions.map(s => s.score))
    
    // Confidence decreases with variance
    const confidence = Math.max(0, Math.min(1, 1 - (variance / 100)))
    
    const needsMoreSubmissions = submissions.length < this.consensusThreshold

    return {
      likelyScore: Math.round(medianScore),
      confidence,
      needsMoreSubmissions
    }
  }

  // Helper methods

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0
    
    const sorted = [...numbers].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2
    } else {
      return sorted[mid]
    }
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0
    
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2))
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / numbers.length
  }

  private calculateStandardDeviation(numbers: number[]): number {
    return Math.sqrt(this.calculateVariance(numbers))
  }

  private identifyOutliers(submissions: VerificationSubmission[]): VerificationSubmission[] {
    if (submissions.length < 3) return []
    
    const scores = submissions.map(s => s.score)
    const median = this.calculateMedian(scores)
    const tolerance = (median * this.scoreVarianceTolerance) / 100
    
    return submissions.filter(sub => {
      const diff = Math.abs(sub.score - median)
      return diff > tolerance
    })
  }

  /**
   * Check if a specific oracle's submission aligns with consensus
   */
  checkOracleAlignment(
    oracleAddress: string,
    submissions: VerificationSubmission[]
  ): {
    isAligned: boolean
    deviation: number
    score: number
  } {
    const oracleSubmission = submissions.find(
      s => s.verifier.toLowerCase() === oracleAddress.toLowerCase()
    )
    
    if (!oracleSubmission) {
      return {
        isAligned: false,
        deviation: 100,
        score: 0
      }
    }

    const medianScore = this.calculateMedian(submissions.map(s => s.score))
    const deviation = Math.abs(oracleSubmission.score - medianScore)
    const tolerance = (medianScore * this.scoreVarianceTolerance) / 100
    
    return {
      isAligned: deviation <= tolerance,
      deviation,
      score: oracleSubmission.score
    }
  }

  /**
   * Get recommended actions for consensus
   */
  getRecommendedActions(submissions: VerificationSubmission[]): string[] {
    const actions: string[] = []
    
    if (submissions.length < this.consensusThreshold) {
      actions.push(`Need ${this.consensusThreshold - submissions.length} more oracle submissions`)
    }
    
    if (submissions.length >= this.consensusThreshold) {
      const hasConsensus = this.detectConsensus(submissions)
      if (!hasConsensus) {
        actions.push('Consensus not reached - scores too divergent')
        actions.push('Consider dispute resolution or additional oracles')
      } else {
        actions.push('Consensus reached - ready to finalize')
      }
    }
    
    const outliers = this.identifyOutliers(submissions)
    if (outliers.length > 0) {
      actions.push(`${outliers.length} oracle(s) submitted outlier scores`)
    }
    
    return actions
  }
}













