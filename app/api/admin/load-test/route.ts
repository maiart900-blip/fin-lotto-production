/**
 * Load Test API
 * Provides load test status and simple internal stress testing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

// Simple in-memory stress test results
const testResults: Map<string, {
  id: string
  status: 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  endpoints: string[]
  results: {
    endpoint: string
    responseTime: number
    status: number
    error?: string
  }[]
  summary?: {
    totalRequests: number
    avgResponseTime: number
    p95ResponseTime: number
    errorRate: number
  }
}> = new Map()

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser()
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'
    const testId = searchParams.get('test_id')

    switch (action) {
      case 'status': {
        // Return all test results.
        // `result` already contains its own `id`, so do not add `id` again.
        const results = Array.from(testResults.values())
        return NextResponse.json({ success: true, data: results })
      }

      case 'result': {
        if (!testId) {
          return NextResponse.json({ error: 'test_id required' }, { status: 400 })
        }

        const result = testResults.get(testId)

        if (!result) {
          return NextResponse.json({ error: 'Test not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: result })
      }

      case 'endpoints': {
        // Return list of testable endpoints
        const endpoints = [
          { path: '/api/health', name: 'Health Check', category: 'monitoring' },
          { path: '/api/lotteries', name: 'Lotteries List', category: 'public' },
          { path: '/api/announcements', name: 'Announcements', category: 'public' },
          { path: '/api/dashboard/stats', name: 'Dashboard Stats', category: 'admin' },
          { path: '/api/customers?limit=10', name: 'Customers List', category: 'admin' },
          { path: '/api/agents?limit=10', name: 'Agents List', category: 'admin' },
          { path: '/api/entries?limit=20', name: 'Entries List', category: 'admin' },
          { path: '/api/bets?limit=20', name: 'Bets List', category: 'admin' },
          { path: '/api/credits', name: 'Credits', category: 'financial' },
          { path: '/api/financial/ledger?limit=20', name: 'Ledger', category: 'financial' },
          { path: '/api/jobs/stats', name: 'Job Queue Stats', category: 'monitoring' },
        ]

        return NextResponse.json({ success: true, data: endpoints })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Load test GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser()
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, endpoints, iterations = 10 } = body

    switch (action) {
      case 'run': {
        if (!endpoints || !Array.isArray(endpoints) || endpoints.length === 0) {
          return NextResponse.json({ error: 'endpoints array required' }, { status: 400 })
        }

        // Limit iterations for safety
        const safeIterations = Math.min(iterations, 100)

        const testId = `test_${Date.now()}`
        const test = {
          id: testId,
          status: 'running' as const,
          startedAt: new Date(),
          endpoints,
          results: [] as {
            endpoint: string
            responseTime: number
            status: number
            error?: string
          }[],
        }

        testResults.set(testId, test)

        // Run test in background (non-blocking)
        runStressTest(
          testId,
          endpoints,
          safeIterations,
          request.headers.get('cookie') || ''
        ).catch((err) => {
          console.error('Load test background error:', err)

          const existingTest = testResults.get(testId)

          if (existingTest) {
            existingTest.status = 'failed'
            existingTest.completedAt = new Date()
          }
        })

        return NextResponse.json({
          success: true,
          data: {
            testId,
            message: 'Test started',
            endpoints: endpoints.length,
            iterations: safeIterations,
          },
        })
      }

      case 'quick': {
        // Quick single-pass health check of all critical endpoints
        const criticalEndpoints = [
          '/api/health',
          '/api/lotteries',
          '/api/dashboard/stats',
          '/api/customers?limit=1',
          '/api/entries?limit=1',
        ]

        const results = await Promise.all(
          criticalEndpoints.map(async (endpoint) => {
            const startTime = Date.now()

            try {
              const baseUrl = request.headers.get('host') || 'localhost:3000'
              const protocol = request.headers.get('x-forwarded-proto') || 'http'
              const url = `${protocol}://${baseUrl}${endpoint}`

              const res = await fetch(url, {
                headers: {
                  Cookie: request.headers.get('cookie') || '',
                },
              })

              return {
                endpoint,
                responseTime: Date.now() - startTime,
                status: res.status,
                ok: res.ok,
              }
            } catch (error) {
              return {
                endpoint,
                responseTime: Date.now() - startTime,
                status: 0,
                ok: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            }
          })
        )

        const avgResponseTime =
          results.reduce((sum, r) => sum + r.responseTime, 0) / results.length

        const errorCount = results.filter((r) => !r.ok).length

        return NextResponse.json({
          success: true,
          data: {
            results,
            summary: {
              totalEndpoints: results.length,
              avgResponseTime: Math.round(avgResponseTime),
              errorCount,
              healthScore: Math.round(
                ((results.length - errorCount) / results.length) * 100
              ),
            },
          },
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Load test POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function runStressTest(
  testId: string,
  endpoints: string[],
  iterations: number,
  cookie: string
) {
  const test = testResults.get(testId)

  if (!test) return

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  for (let i = 0; i < iterations; i++) {
    for (const endpoint of endpoints) {
      const startTime = Date.now()

      try {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          headers: { Cookie: cookie },
        })

        test.results.push({
          endpoint,
          responseTime: Date.now() - startTime,
          status: res.status,
        })
      } catch (error) {
        test.results.push({
          endpoint,
          responseTime: Date.now() - startTime,
          status: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Small delay between iterations to avoid overwhelming
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Calculate summary
  const responseTimes = test.results
    .map((r) => r.responseTime)
    .sort((a, b) => a - b)

  const errors = test.results.filter(
    (r) => r.status >= 400 || r.status === 0
  )

  test.status = 'completed'
  test.completedAt = new Date()
  test.summary = {
    totalRequests: test.results.length,
    avgResponseTime:
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          )
        : 0,
    p95ResponseTime:
      responseTimes[Math.floor(responseTimes.length * 0.95)] || 0,
    errorRate:
      test.results.length > 0 ? errors.length / test.results.length : 0,
  }
}