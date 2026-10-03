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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-white border border-gray-200 p-5">
          <div className="text-sm text-gray-600 mb-1">逾期未还</div>
          <div className="text-3xl font-semibold text-red-600">{overdueInstallments.length}</div>
        </div>
        <div className="bg-white border border-gray-200 p-5">
          <div className="text-sm text-gray-600 mb-1">本月待还</div>
          <div className="text-3xl font-semibold text-gray-700">{pendingInstallments.length}</div>
        </div>
        <div className="bg-white border border-gray-200 p-5">
          <div className="text-sm text-gray-600 mb-1">本月合计</div>
          <div className="text-3xl font-semibold text-gray-900">
            ¥{monthTotal.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Loan Repayments */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-4">
          {installments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">本月无需还款</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overdue Loans */}
              {overdueInstallments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    逾期未还 ({overdueInstallments.length})
                  </h3>
                  <div className="space-y-2">
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
                          className="flex items-center justify-between p-3 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-3">
                              <span className="text-sm font-medium text-gray-900">{installment.loan.vehicle.plateNo}</span>
                              <span className="text-xs text-gray-600">第 {installment.periodNumber} 期</span>
                              <span className="text-xs text-gray-500">{installment.loan.lender}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              应还金额: ¥{Number(installment.loan.monthlyPayment).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <div className="text-sm text-gray-900">
                              {monthlyLoanSummary.month}月{dueDay}日
                            </div>
                            <div className="text-xs text-red-600 font-medium mt-0.5">
                              已逾期 {daysOverdue} 天
                            </div>
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
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    本月待还 ({pendingInstallments.length})
                  </h3>
                  <div className="space-y-2">
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
                          className={`flex items-center justify-between p-3 border transition-colors ${
                            isUrgent
                              ? 'border-orange-200 bg-orange-50 hover:bg-orange-100'
                              : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-3">
                              <span className="text-sm font-medium text-gray-900">{installment.loan.vehicle.plateNo}</span>
                              <span className="text-xs text-gray-600">第 {installment.periodNumber} 期</span>
                              <span className="text-xs text-gray-500">{installment.loan.lender}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              应还金额: ¥{Number(installment.loan.monthlyPayment).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <div className="text-sm text-gray-900">
                              {monthlyLoanSummary.month}月{dueDay}日
                            </div>
                            <div className={`text-xs font-medium mt-0.5 ${isUrgent ? 'text-orange-500' : 'text-gray-600'}`}>
                              {daysLeft} 天后到期
                            </div>
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
