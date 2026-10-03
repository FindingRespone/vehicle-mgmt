import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function LoansPage() {
  const session = await auth();
  
  if (!session) {
    return null;
  }

  // Only SUPER_ADMIN can access
  if (session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const installments = await prisma.loanInstallment.findMany({
    where: {
      dueDate: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth,
      },
    },
    include: {
      loan: {
        include: {
          vehicle: {
            select: {
              id: true,
              plateNo: true,
              brandModel: true,
            },
          },
        },
      },
    },
    orderBy: {
      dueDate: 'asc',
    },
  });

  const monthTotal = installments.reduce((sum, inst) => {
    return sum + Number(inst.loan.monthlyPayment);
  }, 0);

  const vehicleCount = new Set(installments.map(inst => inst.loan.vehicleId)).size;

  const monthlyLoanSummary = {
    installments,
    monthTotal,
    installmentCount: installments.length,
    vehicleCount,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };

  const overdueInstallments = installments.filter((inst: any) => {
    const dueDate = new Date(inst.dueDate);
    return dueDate < now && !inst.paidAt;
  });

  const pendingInstallments = installments.filter((inst: any) => {
    const dueDate = new Date(inst.dueDate);
    return dueDate >= now && !inst.paidAt;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">贷款还款事项</h1>
          <p className="mt-2 text-sm text-gray-600">
            {monthlyLoanSummary.year}年{monthlyLoanSummary.month}月应还贷款
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          返回工作台
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="card p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600">{overdueInstallments.length}</div>
            <div className="text-sm text-gray-600 mt-2">逾期未还</div>
          </div>
        </div>
        <div className="card p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">{pendingInstallments.length}</div>
            <div className="text-sm text-gray-600 mt-2">本月待还</div>
          </div>
        </div>
        <div className="card p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600">
              ¥{monthTotal.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-gray-600 mt-2">本月合计</div>
          </div>
        </div>
      </div>

      {/* Loan Repayments */}
      <div className="card">
        <div className="px-6 py-4">
          {installments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2">本月无需还款</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overdue Loans */}
              {overdueInstallments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    逾期未还 ({overdueInstallments.length})
                  </h3>
                  <div className="space-y-3">
                    {overdueInstallments.map((installment: any) => {
                      const dueDate = new Date(installment.dueDate);
                      const daysOverdue = Math.floor(
                        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const dueDay = dueDate.getDate();

                      return (
                        <Link
                          key={installment.id}
                          href={`/vehicles/${installment.loan.vehicle.id}`}
                          className="flex items-center justify-between p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                        >
                          <div className="flex items-center space-x-4 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-red-100">
                              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{installment.loan.vehicle.plateNo}</p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                第 {installment.periodNumber} 期 · {installment.loan.lender}
                              </p>
                              <p className="text-xs text-gray-500">
                                应还金额: ¥{Number(installment.loan.monthlyPayment).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {monthlyLoanSummary.month}月{dueDay}日
                              </p>
                              <p className="text-xs text-red-600 font-medium">
                                已逾期 {daysOverdue} 天
                              </p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pending Loans */}
              {pendingInstallments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-600 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    本月待还 ({pendingInstallments.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingInstallments.map((installment: any) => {
                      const dueDate = new Date(installment.dueDate);
                      const daysLeft = Math.floor(
                        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isUrgent = daysLeft <= 7;
                      const dueDay = dueDate.getDate();

                      return (
                        <Link
                          key={installment.id}
                          href={`/vehicles/${installment.loan.vehicle.id}`}
                          className={`flex items-center justify-between p-4 rounded-lg transition-colors border ${
                            isUrgent
                              ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                              : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          <div className="flex items-center space-x-4 flex-1 min-w-0">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                              isUrgent ? 'bg-orange-100' : 'bg-blue-100'
                            }`}>
                              <svg className={`w-6 h-6 ${isUrgent ? 'text-orange-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{installment.loan.vehicle.plateNo}</p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                第 {installment.periodNumber} 期 · {installment.loan.lender}
                              </p>
                              <p className="text-xs text-gray-500">
                                应还金额: ¥{Number(installment.loan.monthlyPayment).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {monthlyLoanSummary.month}月{dueDay}日
                              </p>
                              <p className={`text-xs font-medium ${isUrgent ? 'text-orange-600' : 'text-blue-600'}`}>
                                {daysLeft} 天后到期
                              </p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
