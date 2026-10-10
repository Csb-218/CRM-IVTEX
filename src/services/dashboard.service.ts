import { Types } from 'mongoose';
import { Lead, LeadStatus, LeadSource } from '../models/lead.model';
import { Deal, DealStage } from '../models/deal.model';
import { Customer, CustomerStatus } from '../models/customer.model';
import { Activity, ActivityStatus, ActivityType } from '../models/activity.model';
import { User, IUser, UserRole } from '../models/user.model';

export interface DashboardQuery {
  startDate?: string;
  endDate?: string;
  timeframe?: 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'all_time';
  assignedTo?: string;
  managerId?: string;
}

export class DashboardService {
  /**
   * Helper to parse date filters from query
   */
  private resolveDateFilter(query: DashboardQuery): { $gte?: Date; $lte?: Date } | null {
    if (query.startDate || query.endDate) {
      const dateRange: { $gte?: Date; $lte?: Date } = {};
      if (query.startDate) dateRange.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (query.endDate.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        dateRange.$lte = end;
      }
      return dateRange;
    }

    if (query.timeframe && query.timeframe !== 'all_time') {
      const now = new Date();
      const start = new Date(now);
      const end = new Date(now);

      switch (query.timeframe) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return { $gte: start, $lte: end };

        case 'this_week': {
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
          start.setDate(diff);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return { $gte: start, $lte: end };
        }

        case 'this_month':
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return { $gte: start, $lte: end };

        case 'this_quarter': {
          const currentQuarterMonth = Math.floor(now.getMonth() / 3) * 3;
          start.setMonth(currentQuarterMonth, 1);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return { $gte: start, $lte: end };
        }

        case 'this_year':
          start.setMonth(0, 1);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return { $gte: start, $lte: end };
      }
    }

    return null;
  }

  /**
   * Helper to resolve team assignedTo IDs based on role
   */
  private async resolveAssignedScope(user: IUser, queryAssignedTo?: string): Promise<Types.ObjectId[] | null> {
    if (user.role === UserRole.EXECUTIVE) {
      return [user._id];
    }

    if (user.role === UserRole.MANAGER) {
      const teamMembers = await User.find({ managerId: user._id, isActive: true }).select('_id');
      const teamIds = [user._id, ...teamMembers.map((m) => m._id)];

      if (queryAssignedTo && Types.ObjectId.isValid(queryAssignedTo)) {
        const requestedId = new Types.ObjectId(queryAssignedTo);
        const hasAccess = teamIds.some((id) => id.toString() === requestedId.toString());
        return hasAccess ? [requestedId] : teamIds;
      }
      return teamIds;
    }

    // Admin
    if (queryAssignedTo && Types.ObjectId.isValid(queryAssignedTo)) {
      return [new Types.ObjectId(queryAssignedTo)];
    }

    return null; // Null means all users across organization
  }

  /**
   * 1. GET /dashboard/summary (Access: A, M, E)
   * Lead, customer, deal, revenue, and activity metrics, plus conversion rate
   */
  async getSummary(query: DashboardQuery, user: IUser) {
    const dateRange = this.resolveDateFilter(query);
    const assignedScope = await this.resolveAssignedScope(user, query.assignedTo);

    const leadMatch: Record<string, any> = {};
    const customerMatch: Record<string, any> = {};
    const dealMatch: Record<string, any> = {};
    const activityMatch: Record<string, any> = {};

    if (assignedScope) {
      leadMatch.assignedTo = { $in: assignedScope };
      customerMatch.assignedTo = { $in: assignedScope };
      dealMatch.assignedTo = { $in: assignedScope };
      activityMatch.$or = [
        { assignedTo: { $in: assignedScope } },
        { createdBy: { $in: assignedScope } }
      ];
    }

    if (dateRange) {
      leadMatch.createdAt = dateRange;
      customerMatch.createdAt = dateRange;
      dealMatch.createdAt = dateRange;
      activityMatch.createdAt = dateRange;
    }

    // Run parallel aggregation pipelines
    const [leadAgg, customerAgg, dealAgg, activityAgg] = await Promise.all([
      // Lead pipeline
      Lead.aggregate([
        { $match: leadMatch },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }]
          }
        }
      ]),

      // Customer pipeline
      Customer.aggregate([
        { $match: customerMatch },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }]
          }
        }
      ]),

      // Deal & Revenue pipeline
      Deal.aggregate([
        { $match: dealMatch },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStage: [
              {
                $group: {
                  _id: '$stage',
                  count: { $sum: 1 },
                  totalValue: { $sum: '$value' },
                  expectedRevenue: { $sum: '$expectedRevenue' }
                }
              }
            ],
            revenue: [
              {
                $group: {
                  _id: null,
                  totalDealValue: { $sum: '$value' },
                  wonRevenue: {
                    $sum: { $cond: [{ $eq: ['$stage', DealStage.WON] }, '$value', 0] }
                  },
                  lostValue: {
                    $sum: { $cond: [{ $eq: ['$stage', DealStage.LOST] }, '$value', 0] }
                  },
                  pipelineValue: {
                    $sum: {
                      $cond: [{ $not: { $in: ['$stage', [DealStage.WON, DealStage.LOST]] } }, '$value', 0]
                    }
                  },
                  expectedRevenue: {
                    $sum: {
                      $cond: [{ $not: { $in: ['$stage', [DealStage.WON, DealStage.LOST]] } }, '$expectedRevenue', 0]
                    }
                  },
                  wonDealsCount: {
                    $sum: { $cond: [{ $eq: ['$stage', DealStage.WON] }, 1, 0] }
                  },
                  lostDealsCount: {
                    $sum: { $cond: [{ $eq: ['$stage', DealStage.LOST] }, 1, 0] }
                  },
                  openDealsCount: {
                    $sum: {
                      $cond: [{ $not: { $in: ['$stage', [DealStage.WON, DealStage.LOST]] } }, 1, 0]
                    }
                  }
                }
              }
            ]
          }
        }
      ]),

      // Activity pipeline
      Activity.aggregate([
        { $match: activityMatch },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
            overdue: [
              {
                $match: {
                  status: ActivityStatus.PENDING,
                  dueDate: { $ne: null, $lt: new Date() }
                }
              },
              { $count: 'count' }
            ]
          }
        }
      ])
    ]);

    // Format Leads metrics
    const leadFacet = leadAgg[0] || {};
    const totalLeads = leadFacet.total?.[0]?.count || 0;
    const leadsByStatusMap: Record<string, number> = {};
    (leadFacet.byStatus || []).forEach((item: any) => {
      leadsByStatusMap[item._id] = item.count;
    });
    const convertedLeads = leadsByStatusMap[LeadStatus.CONVERTED] || 0;
    const leadConversionRate = totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(2)) : 0;

    // Format Customers metrics
    const customerFacet = customerAgg[0] || {};
    const totalCustomers = customerFacet.total?.[0]?.count || 0;
    const customersByStatusMap: Record<string, number> = {};
    (customerFacet.byStatus || []).forEach((item: any) => {
      customersByStatusMap[item._id] = item.count;
    });

    // Format Deals & Revenue metrics
    const dealFacet = dealAgg[0] || {};
    const totalDeals = dealFacet.total?.[0]?.count || 0;
    const revenueStats = dealFacet.revenue?.[0] || {
      totalDealValue: 0,
      wonRevenue: 0,
      lostValue: 0,
      pipelineValue: 0,
      expectedRevenue: 0,
      wonDealsCount: 0,
      lostDealsCount: 0,
      openDealsCount: 0
    };

    const dealsByStageMap: Record<string, { count: number; totalValue: number; expectedRevenue: number }> = {};
    (dealFacet.byStage || []).forEach((item: any) => {
      dealsByStageMap[item._id] = {
        count: item.count,
        totalValue: Math.round(item.totalValue * 100) / 100,
        expectedRevenue: Math.round(item.expectedRevenue * 100) / 100
      };
    });

    const closedDealsCount = revenueStats.wonDealsCount + revenueStats.lostDealsCount;
    const dealWinRate = closedDealsCount > 0
      ? Number(((revenueStats.wonDealsCount / closedDealsCount) * 100).toFixed(2))
      : 0;

    const averageWonDealValue = revenueStats.wonDealsCount > 0
      ? Number((revenueStats.wonRevenue / revenueStats.wonDealsCount).toFixed(2))
      : 0;

    // Format Activities metrics
    const activityFacet = activityAgg[0] || {};
    const totalActivities = activityFacet.total?.[0]?.count || 0;
    const activitiesByStatusMap: Record<string, number> = {};
    (activityFacet.byStatus || []).forEach((item: any) => {
      activitiesByStatusMap[item._id] = item.count;
    });
    const completedActivities = activitiesByStatusMap[ActivityStatus.COMPLETED] || 0;
    const pendingActivities = activitiesByStatusMap[ActivityStatus.PENDING] || 0;
    const overdueActivities = activityFacet.overdue?.[0]?.count || 0;
    const activityCompletionRate = totalActivities > 0
      ? Number(((completedActivities / totalActivities) * 100).toFixed(2))
      : 0;

    return {
      timeframe: query.timeframe || (query.startDate || query.endDate ? 'custom' : 'all_time'),
      leads: {
        total: totalLeads,
        byStatus: {
          new: leadsByStatusMap[LeadStatus.NEW] || 0,
          contacted: leadsByStatusMap[LeadStatus.CONTACTED] || 0,
          qualified: leadsByStatusMap[LeadStatus.QUALIFIED] || 0,
          unqualified: leadsByStatusMap[LeadStatus.UNQUALIFIED] || 0,
          converted: convertedLeads,
          lost: leadsByStatusMap[LeadStatus.LOST] || 0
        },
        conversionRate: leadConversionRate
      },
      customers: {
        total: totalCustomers,
        active: customersByStatusMap[CustomerStatus.ACTIVE] || 0,
        inactive: customersByStatusMap[CustomerStatus.INACTIVE] || 0
      },
      deals: {
        total: totalDeals,
        open: revenueStats.openDealsCount,
        won: revenueStats.wonDealsCount,
        lost: revenueStats.lostDealsCount,
        winRate: dealWinRate,
        byStage: dealsByStageMap
      },
      revenue: {
        wonRevenue: Math.round(revenueStats.wonRevenue * 100) / 100,
        pipelineValue: Math.round(revenueStats.pipelineValue * 100) / 100,
        expectedRevenue: Math.round(revenueStats.expectedRevenue * 100) / 100,
        totalDealValue: Math.round(revenueStats.totalDealValue * 100) / 100,
        lostValue: Math.round(revenueStats.lostValue * 100) / 100,
        averageWonDealValue
      },
      activities: {
        total: totalActivities,
        completed: completedActivities,
        pending: pendingActivities,
        overdue: overdueActivities,
        completionRate: activityCompletionRate
      }
    };
  }

  /**
   * 2. GET /dashboard/pipeline (Access: A, M, E)
   * Deal count and value per stage
   */
  async getPipeline(query: DashboardQuery, user: IUser) {
    const dateRange = this.resolveDateFilter(query);
    const assignedScope = await this.resolveAssignedScope(user, query.assignedTo);

    const dealMatch: Record<string, any> = {};
    if (assignedScope) {
      dealMatch.assignedTo = { $in: assignedScope };
    }
    if (dateRange) {
      dealMatch.createdAt = dateRange;
    }

    const stagesAggregation = await Deal.aggregate([
      { $match: dealMatch },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
          totalValue: { $sum: '$value' },
          totalExpectedRevenue: { $sum: '$expectedRevenue' },
          avgValue: { $avg: '$value' },
          avgProbability: { $avg: '$probability' }
        }
      }
    ]);

    const stageMap = new Map<string, any>();
    stagesAggregation.forEach((s) => {
      stageMap.set(s._id, s);
    });

    const orderedStages = [
      DealStage.QUALIFICATION,
      DealStage.DISCOVERY,
      DealStage.PROPOSAL,
      DealStage.NEGOTIATION,
      DealStage.WON,
      DealStage.LOST
    ];

    let totalDeals = 0;
    let totalValue = 0;
    let activePipelineDeals = 0;
    let activePipelineValue = 0;
    let activeExpectedRevenue = 0;
    let wonDeals = 0;
    let wonValue = 0;
    let lostDeals = 0;
    let lostValue = 0;

    const stagesBreakdown = orderedStages.map((stage) => {
      const data = stageMap.get(stage);
      const count = data ? data.count : 0;
      const stageValue = data ? Math.round(data.totalValue * 100) / 100 : 0;
      const expectedRev = data ? Math.round(data.totalExpectedRevenue * 100) / 100 : 0;
      const avgVal = data ? Math.round(data.avgValue * 100) / 100 : 0;
      const avgProb = data ? Math.round(data.avgProbability * 10) / 10 : 0;

      totalDeals += count;
      totalValue += stageValue;

      if (stage === DealStage.WON) {
        wonDeals += count;
        wonValue += stageValue;
      } else if (stage === DealStage.LOST) {
        lostDeals += count;
        lostValue += stageValue;
      } else {
        activePipelineDeals += count;
        activePipelineValue += stageValue;
        activeExpectedRevenue += expectedRev;
      }

      return {
        stage,
        count,
        totalValue: stageValue,
        expectedRevenue: expectedRev,
        averageValue: avgVal,
        averageProbability: avgProb
      };
    });

    const closedDeals = wonDeals + lostDeals;
    const winRate = closedDeals > 0 ? Number(((wonDeals / closedDeals) * 100).toFixed(2)) : 0;

    return {
      summary: {
        totalDeals,
        totalValue: Math.round(totalValue * 100) / 100,
        activePipelineDeals,
        activePipelineValue: Math.round(activePipelineValue * 100) / 100,
        activeExpectedRevenue: Math.round(activeExpectedRevenue * 100) / 100,
        wonDeals,
        wonValue: Math.round(wonValue * 100) / 100,
        lostDeals,
        lostValue: Math.round(lostValue * 100) / 100,
        winRate
      },
      stages: stagesBreakdown
    };
  }

  /**
   * 3. GET /dashboard/team-performance (Access: A, M)
   * Per-executive leads, conversions, revenue
   */
  async getTeamPerformance(query: DashboardQuery, user: IUser) {
    const dateRange = this.resolveDateFilter(query);

    // Executives to include
    const executiveFilter: Record<string, any> = {
      role: UserRole.EXECUTIVE,
      isActive: true
    };

    if (user.role === UserRole.MANAGER) {
      executiveFilter.managerId = user._id;
    } else if (query.managerId && Types.ObjectId.isValid(query.managerId)) {
      executiveFilter.managerId = new Types.ObjectId(query.managerId);
    }

    const executives = await User.find(executiveFilter)
      .select('_id name email phone managerId')
      .populate('managerId', 'name email');

    if (executives.length === 0) {
      return {
        teamSize: 0,
        teamTotals: {
          totalLeads: 0,
          convertedLeads: 0,
          leadConversionRate: 0,
          totalDeals: 0,
          wonDeals: 0,
          dealWinRate: 0,
          wonRevenue: 0,
          pipelineValue: 0
        },
        executives: []
      };
    }

    const executiveIds = executives.map((e) => e._id);

    const leadMatch: Record<string, any> = { assignedTo: { $in: executiveIds } };
    const dealMatch: Record<string, any> = { assignedTo: { $in: executiveIds } };
    const activityMatch: Record<string, any> = { assignedTo: { $in: executiveIds } };

    if (dateRange) {
      leadMatch.createdAt = dateRange;
      dealMatch.createdAt = dateRange;
      activityMatch.createdAt = dateRange;
    }

    // Run parallel aggregation queries for executives
    const [leadsByExec, dealsByExec, activitiesByExec] = await Promise.all([
      // Leads by executive
      Lead.aggregate([
        { $match: leadMatch },
        {
          $group: {
            _id: '$assignedTo',
            totalLeads: { $sum: 1 },
            convertedLeads: {
              $sum: { $cond: [{ $eq: ['$status', LeadStatus.CONVERTED] }, 1, 0] }
            },
            qualifiedLeads: {
              $sum: { $cond: [{ $eq: ['$status', LeadStatus.QUALIFIED] }, 1, 0] }
            },
            newLeads: {
              $sum: { $cond: [{ $eq: ['$status', LeadStatus.NEW] }, 1, 0] }
            },
            lostLeads: {
              $sum: { $cond: [{ $eq: ['$status', LeadStatus.LOST] }, 1, 0] }
            }
          }
        }
      ]),

      // Deals & revenue by executive
      Deal.aggregate([
        { $match: dealMatch },
        {
          $group: {
            _id: '$assignedTo',
            totalDeals: { $sum: 1 },
            wonDeals: {
              $sum: { $cond: [{ $eq: ['$stage', DealStage.WON] }, 1, 0] }
            },
            lostDeals: {
              $sum: { $cond: [{ $eq: ['$stage', DealStage.LOST] }, 1, 0] }
            },
            activeDeals: {
              $sum: {
                $cond: [{ $not: { $in: ['$stage', [DealStage.WON, DealStage.LOST]] } }, 1, 0]
              }
            },
            wonRevenue: {
              $sum: { $cond: [{ $eq: ['$stage', DealStage.WON] }, '$value', 0] }
            },
            pipelineValue: {
              $sum: {
                $cond: [{ $not: { $in: ['$stage', [DealStage.WON, DealStage.LOST]] } }, '$value', 0]
              }
            },
            expectedRevenue: {
              $sum: {
                $cond: [{ $not: { $in: ['$stage', [DealStage.WON, DealStage.LOST]] } }, '$expectedRevenue', 0]
              }
            }
          }
        }
      ]),

      // Activities by executive
      Activity.aggregate([
        { $match: activityMatch },
        {
          $group: {
            _id: '$assignedTo',
            totalActivities: { $sum: 1 },
            completedActivities: {
              $sum: { $cond: [{ $eq: ['$status', ActivityStatus.COMPLETED] }, 1, 0] }
            },
            pendingActivities: {
              $sum: { $cond: [{ $eq: ['$status', ActivityStatus.PENDING] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const leadStatsMap = new Map<string, any>();
    leadsByExec.forEach((l) => leadStatsMap.set(l._id.toString(), l));

    const dealStatsMap = new Map<string, any>();
    dealsByExec.forEach((d) => dealStatsMap.set(d._id.toString(), d));

    const actStatsMap = new Map<string, any>();
    activitiesByExec.forEach((a) => actStatsMap.set(a._id.toString(), a));

    let teamTotalLeads = 0;
    let teamConvertedLeads = 0;
    let teamTotalDeals = 0;
    let teamWonDeals = 0;
    let teamWonRevenue = 0;
    let teamPipelineValue = 0;

    const executivePerformance = executives.map((exec) => {
      const eId = exec._id.toString();
      const lData = leadStatsMap.get(eId) || {
        totalLeads: 0,
        convertedLeads: 0,
        qualifiedLeads: 0,
        newLeads: 0,
        lostLeads: 0
      };
      const dData = dealStatsMap.get(eId) || {
        totalDeals: 0,
        wonDeals: 0,
        lostDeals: 0,
        activeDeals: 0,
        wonRevenue: 0,
        pipelineValue: 0,
        expectedRevenue: 0
      };
      const aData = actStatsMap.get(eId) || {
        totalActivities: 0,
        completedActivities: 0,
        pendingActivities: 0
      };

      const leadConversionRate = lData.totalLeads > 0
        ? Number(((lData.convertedLeads / lData.totalLeads) * 100).toFixed(2))
        : 0;

      const closedDeals = dData.wonDeals + dData.lostDeals;
      const dealWinRate = closedDeals > 0
        ? Number(((dData.wonDeals / closedDeals) * 100).toFixed(2))
        : 0;

      teamTotalLeads += lData.totalLeads;
      teamConvertedLeads += lData.convertedLeads;
      teamTotalDeals += dData.totalDeals;
      teamWonDeals += dData.wonDeals;
      teamWonRevenue += dData.wonRevenue;
      teamPipelineValue += dData.pipelineValue;

      return {
        executive: {
          _id: exec._id,
          name: exec.name,
          email: exec.email,
          phone: exec.phone,
          manager: exec.managerId
        },
        leads: {
          total: lData.totalLeads,
          converted: lData.convertedLeads,
          qualified: lData.qualifiedLeads,
          new: lData.newLeads,
          lost: lData.lostLeads,
          conversionRate: leadConversionRate
        },
        deals: {
          total: dData.totalDeals,
          won: dData.wonDeals,
          lost: dData.lostDeals,
          active: dData.activeDeals,
          winRate: dealWinRate
        },
        revenue: {
          wonRevenue: Math.round(dData.wonRevenue * 100) / 100,
          pipelineValue: Math.round(dData.pipelineValue * 100) / 100,
          expectedRevenue: Math.round(dData.expectedRevenue * 100) / 100
        },
        activities: {
          total: aData.totalActivities,
          completed: aData.completedActivities,
          pending: aData.pendingActivities
        }
      };
    });

    // Sort executives by wonRevenue descending
    executivePerformance.sort((a, b) => b.revenue.wonRevenue - a.revenue.wonRevenue);

    const teamLeadConversionRate = teamTotalLeads > 0
      ? Number(((teamConvertedLeads / teamTotalLeads) * 100).toFixed(2))
      : 0;

    const teamWinRate = teamTotalDeals > 0
      ? Number(((teamWonDeals / teamTotalDeals) * 100).toFixed(2))
      : 0;

    return {
      teamSize: executives.length,
      teamTotals: {
        totalLeads: teamTotalLeads,
        convertedLeads: teamConvertedLeads,
        leadConversionRate: teamLeadConversionRate,
        totalDeals: teamTotalDeals,
        wonDeals: teamWonDeals,
        dealWinRate: teamWinRate,
        wonRevenue: Math.round(teamWonRevenue * 100) / 100,
        pipelineValue: Math.round(teamPipelineValue * 100) / 100
      },
      executives: executivePerformance
    };
  }

  /**
   * 4. GET /dashboard/lead-sources (Access: A, M)
   * Lead count and conversion by source
   */
  async getLeadSources(query: DashboardQuery, user: IUser) {
    const dateRange = this.resolveDateFilter(query);
    const assignedScope = await this.resolveAssignedScope(user, query.assignedTo);

    const leadMatch: Record<string, any> = {};
    if (assignedScope) {
      leadMatch.assignedTo = { $in: assignedScope };
    }
    if (dateRange) {
      leadMatch.createdAt = dateRange;
    }

    const sourceAggregation = await Lead.aggregate([
      { $match: leadMatch },
      {
        $lookup: {
          from: 'deals',
          localField: '_id',
          foreignField: 'leadId',
          as: 'deals'
        }
      },
      {
        $project: {
          source: { $ifNull: ['$source', LeadSource.OTHER] },
          status: 1,
          wonRevenue: {
            $reduce: {
              input: '$deals',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  { $cond: [{ $eq: ['$$this.stage', DealStage.WON] }, '$$this.value', 0] }
                ]
              }
            }
          },
          totalDealValue: {
            $reduce: {
              input: '$deals',
              initialValue: 0,
              in: { $add: ['$$value', '$$this.value'] }
            }
          }
        }
      },
      {
        $group: {
          _id: '$source',
          totalLeads: { $sum: 1 },
          convertedLeads: {
            $sum: { $cond: [{ $eq: ['$status', LeadStatus.CONVERTED] }, 1, 0] }
          },
          qualifiedLeads: {
            $sum: { $cond: [{ $eq: ['$status', LeadStatus.QUALIFIED] }, 1, 0] }
          },
          lostLeads: {
            $sum: { $cond: [{ $eq: ['$status', LeadStatus.LOST] }, 1, 0] }
          },
          wonRevenue: { $sum: '$wonRevenue' },
          totalDealValue: { $sum: '$totalDealValue' }
        }
      },
      { $sort: { totalLeads: -1 } }
    ]);

    const sourceMap = new Map<string, any>();
    let overallLeads = 0;
    let overallConverted = 0;
    let overallWonRevenue = 0;

    sourceAggregation.forEach((item) => {
      sourceMap.set(item._id, item);
      overallLeads += item.totalLeads;
      overallConverted += item.convertedLeads;
      overallWonRevenue += item.wonRevenue;
    });

    const allSources = Object.values(LeadSource);

    const breakdown = allSources.map((source) => {
      const data = sourceMap.get(source);
      const totalLeads = data ? data.totalLeads : 0;
      const convertedLeads = data ? data.convertedLeads : 0;
      const qualifiedLeads = data ? data.qualifiedLeads : 0;
      const lostLeads = data ? data.lostLeads : 0;
      const wonRev = data ? Math.round(data.wonRevenue * 100) / 100 : 0;

      const conversionRate = totalLeads > 0
        ? Number(((convertedLeads / totalLeads) * 100).toFixed(2))
        : 0;

      const percentageOfTotal = overallLeads > 0
        ? Number(((totalLeads / overallLeads) * 100).toFixed(2))
        : 0;

      return {
        source,
        totalLeads,
        convertedLeads,
        qualifiedLeads,
        lostLeads,
        conversionRate,
        percentageOfTotal,
        wonRevenue: wonRev
      };
    });

    // Sort breakdown by totalLeads descending
    breakdown.sort((a, b) => b.totalLeads - a.totalLeads);

    const overallConversionRate = overallLeads > 0
      ? Number(((overallConverted / overallLeads) * 100).toFixed(2))
      : 0;

    return {
      summary: {
        totalLeads: overallLeads,
        convertedLeads: overallConverted,
        conversionRate: overallConversionRate,
        wonRevenue: Math.round(overallWonRevenue * 100) / 100
      },
      sources: breakdown
    };
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
