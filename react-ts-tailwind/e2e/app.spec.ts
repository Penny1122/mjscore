import { expect, test as base, type Page } from '@playwright/test'
import { FakeSupabase, TEST_PASSWORD } from './fakeSupabase'

const test = base.extend<{ fake: FakeSupabase }>({
  fake: async ({ context }, provide) => {
    const fake = new FakeSupabase()
    await fake.attach(context)
    await provide(fake)
  },
})

type Row = { name: string; score: string; rounds: string }

async function fillRow(page: Page, index: number, row: Row) {
  const n = index + 1
  await page.getByLabel(`第 ${n} 位玩家名字`).fill(row.name)
  await page.getByLabel(`第 ${n} 位玩家金額`).fill(row.score)
  await page.getByLabel(`第 ${n} 位玩家打幾將`).fill(row.rounds)
}

async function unlock(page: Page, password = TEST_PASSWORD) {
  await page.getByRole('navigation').getByRole('button', { name: '解鎖' }).click()
  await page.getByLabel('編輯密碼').fill(password)
  await page.locator('main form').getByRole('button', { name: '解鎖' }).click()
}

const FIVE: Row[] = [
  { name: '阿明', score: '1200', rounds: '2' },
  { name: '小美', score: '-300', rounds: '2' },
  { name: '老王', score: '-500', rounds: '1' },
  { name: '阿華', score: '-600', rounds: '2' },
  { name: '小陳', score: '200', rounds: '1' },
]

async function createFivePlayerRecord(page: Page) {
  await page.getByRole('button', { name: '＋ 新增玩家' }).click()
  for (const [i, row] of FIVE.entries()) await fillRow(page, i, row)
  await page.locator('#house-fee').fill('400')
  await expect(page.getByTestId('total')).toContainText('平衡')
  await page.getByRole('button', { name: '存檔' }).click()
}

async function createAndOpen(page: Page) {
  await createFivePlayerRecord(page)
  await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
}

const nav = (page: Page) => page.getByRole('navigation')

test.describe('唯讀與解鎖', () => {
  test.beforeEach(async ({ page, fake }) => {
    void fake
    await page.goto('/')
  })

  test('一進來是總覽，預設唯讀，看不到新增', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
    await expect(page.getByText('還沒有任何紀錄')).toBeVisible()
    await nav(page).getByRole('button', { name: '歷史紀錄' }).click()
    await expect(nav(page).getByRole('button', { name: '新增紀錄' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '唯讀' })).toBeVisible()
    await expect(page.getByRole('button', { name: '新增第一筆' })).toHaveCount(0)
  })

  test('密碼錯誤顯示錯誤，正確才解鎖', async ({ page }) => {
    await unlock(page, 'wrong-password')
    await expect(page.getByRole('alert')).toContainText('密碼錯誤')
    await expect(nav(page).getByRole('button', { name: '新增紀錄' })).toHaveCount(0)

    await page.getByLabel('編輯密碼').fill(TEST_PASSWORD)
    await page.locator('main form').getByRole('button', { name: '解鎖' }).click()
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: '設定' })).toBeVisible()
  })

  test('解鎖後重新整理仍記住', async ({ page }) => {
    await unlock(page)
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: '新增紀錄' })).toBeVisible()
    await expect(page.getByRole('button', { name: '唯讀' })).toHaveCount(0)
  })

  test('鎖定後恢復唯讀，明細與名單都不能改', async ({ page }) => {
    await unlock(page)
    await createAndOpen(page)
    await nav(page).getByRole('button', { name: '設定' }).click()
    await page.getByRole('button', { name: '鎖定此裝置' }).click()

    await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
    await nav(page).getByRole('button', { name: '歷史紀錄' }).click()
    await page.getByTestId('record-card').click()
    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
    await expect(page.getByRole('button', { name: '編輯' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '刪除' })).toHaveCount(0)

    await nav(page).getByRole('button', { name: '名單' }).click()
    await expect(page.getByText('阿明')).toBeVisible()
    await expect(page.getByLabel('新增牌咖')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^刪除/ })).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('button', { name: '唯讀' })).toBeVisible()
  })

  test('密碼在別處被更改後，寫入失敗並回到唯讀', async ({ page, fake }) => {
    await unlock(page)
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
    fake.password = 'changed-elsewhere'
    await createFivePlayerRecord(page)
    await expect(page.getByRole('heading', { name: '解鎖編輯' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('密碼已變更')
    expect(fake.records).toHaveLength(0)
  })

  test('記住的密碼失效時，啟動就回到唯讀', async ({ page, fake }) => {
    await unlock(page)
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
    fake.password = 'changed-elsewhere'
    await page.reload()
    await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: '新增紀錄' })).toHaveCount(0)
    // 總覽上方顯示提示，點了進解鎖頁
    await page.getByRole('status').filter({ hasText: '密碼已變更' }).click()
    await expect(page.getByRole('heading', { name: '解鎖編輯' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('密碼已變更')
  })

  test('更改密碼', async ({ page, fake }) => {
    await unlock(page)
    await nav(page).getByRole('button', { name: '設定' }).click()
    await page.getByLabel('新密碼').fill('brand-new-pass')
    await page.getByLabel('再輸入一次').fill('brand-new-pass')
    await page.getByRole('button', { name: '更改密碼' }).click()
    await expect(page.getByRole('status')).toContainText('密碼已更改')
    expect(fake.password).toBe('brand-new-pass')

    // 本機已改用新密碼，仍可寫入
    await nav(page).getByRole('button', { name: '新增紀錄' }).click()
    await createAndOpen(page)
    expect(fake.records).toHaveLength(1)
  })
})

test.describe('紀錄', () => {
  test.beforeEach(async ({ page, fake }) => {
    void fake
    await page.goto('/')
    await unlock(page)
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
  })

  test('新增超過 4 人的紀錄，存到資料庫', async ({ page, fake }) => {
    await createAndOpen(page)

    const items = page.locator('main ol li')
    await expect(items).toHaveCount(5)
    await expect(items.first()).toContainText('阿明')
    await expect(items.first()).toContainText('+1200')
    await expect(page.getByText('400 元')).toBeVisible()
    await expect(page.getByText('不計入加總')).toBeVisible()
    // 總將數為最高將數（2, 2, 1, 2, 1 → 2）
    await expect(page.locator('dl')).toContainText('總將數2 將')

    expect(fake.records).toHaveLength(1)
    expect(fake.records[0]).toMatchObject({ house_fee: 400, house_fee_in_total: false })
    expect(fake.records[0].record_players.map((p) => p.name)).toEqual(FIVE.map((r) => r.name))

    await page.reload()
    await nav(page).getByRole('button', { name: '歷史紀錄' }).click()
    const card = page.getByTestId('record-card')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('東錢 400')
    await expect(card).toContainText('5 人')
  })

  test('總和不為 0 時無法存檔，也不會送到資料庫', async ({ page, fake }) => {
    await fillRow(page, 0, { name: 'A', score: '100', rounds: '1' })
    await fillRow(page, 1, { name: 'B', score: '-50', rounds: '1' })
    await fillRow(page, 2, { name: 'C', score: '0', rounds: '1' })
    await fillRow(page, 3, { name: 'D', score: '0', rounds: '1' })
    await expect(page.getByTestId('total')).toContainText('+50，需為 0')

    await page.getByRole('button', { name: '存檔' }).click()
    await expect(page.getByRole('alert')).toContainText('分數總和需為 0')
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
    expect(fake.rpcCalls).not.toContain('save_record')
  })

  test('東錢計入加總時，玩家金額 + 東錢 = 0 才能存', async ({ page, fake }) => {
    await fillRow(page, 0, { name: 'A', score: '800', rounds: '3' })
    await fillRow(page, 1, { name: 'B', score: '-400', rounds: '3' })
    await fillRow(page, 2, { name: 'C', score: '-300', rounds: '3' })
    await fillRow(page, 3, { name: 'D', score: '-500', rounds: '3' })
    await page.locator('#house-fee').fill('400')
    await expect(page.getByTestId('total')).toContainText('-400，需為 0')

    const toggle = page.getByRole('switch', { name: '東錢計入加總' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('total')).toContainText('玩家 -400 ＋ 東錢 400')
    await expect(page.getByTestId('total')).toContainText('平衡')

    await page.getByRole('button', { name: '存檔' }).click()
    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
    await expect(page.getByText('計入加總', { exact: true })).toBeVisible()
    await expect(page.locator('dl')).toContainText('總將數3 將')
    expect(fake.records[0].house_fee_in_total).toBe(true)

    await page.getByRole('button', { name: '編輯' }).click()
    await expect(page.getByRole('switch', { name: '東錢計入加總' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('± 按鈕切換負號', async ({ page }) => {
    const score = page.getByLabel('第 1 位玩家金額')
    await score.fill('300')
    await page.getByRole('button', { name: '切換正負號' }).first().click()
    await expect(score).toHaveValue('-300')
  })

  test('牌咖名單可點選帶入', async ({ page }) => {
    await createAndOpen(page)
    await nav(page).getByRole('button', { name: '新增紀錄' }).click()

    await page.getByLabel('第 1 位玩家名字').click()
    const chips = page.getByLabel('牌咖名單', { exact: true }).getByRole('button')
    await expect(chips).toHaveCount(5)
    await chips.filter({ hasText: '小美' }).click()
    await expect(page.getByLabel('第 1 位玩家名字')).toHaveValue('小美')
    await expect(page.getByLabel('第 1 位玩家金額')).toBeFocused()

    await page.getByLabel('第 2 位玩家名字').click()
    await expect(chips).toHaveCount(4)
    await expect(chips.filter({ hasText: '小美' })).toHaveCount(0)
    await page.getByLabel('第 2 位玩家名字').fill('阿')
    await expect(chips).toHaveCount(2)
  })

  test('刪除牌咖', async ({ page, fake }) => {
    await createAndOpen(page)
    await nav(page).getByRole('button', { name: '名單' }).click()
    await page.getByRole('button', { name: '刪除 小美' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '移除' }).click()
    await expect(page.getByText('小美')).toHaveCount(0)
    expect(fake.players.map((p) => p.name)).not.toContain('小美')
  })

  test('編輯紀錄後資料正確', async ({ page, fake }) => {
    await createAndOpen(page)
    await page.getByRole('button', { name: '編輯' }).click()
    await expect(page.getByLabel('第 1 位玩家名字')).toHaveValue('阿明')

    await page.getByRole('button', { name: '移除第 5 位玩家' }).click()
    await page.getByLabel('第 1 位玩家金額').fill('1400')
    await page.locator('#house-fee').fill('')
    await page.getByRole('button', { name: '儲存修改' }).click()

    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
    await expect(page.locator('main ol li')).toHaveCount(4)
    await expect(page.locator('main ol li').first()).toContainText('+1400')
    await expect(page.getByText('修改：')).toBeVisible()
    expect(fake.records).toHaveLength(1)
    expect(fake.records[0]).toMatchObject({ house_fee: null })
    expect(fake.records[0].record_players).toHaveLength(4)
  })

  test('取消編輯不變動資料', async ({ page, fake }) => {
    await createAndOpen(page)
    await page.getByRole('button', { name: '編輯' }).click()
    await page.getByLabel('第 1 位玩家金額').fill('9999')
    await page.getByRole('button', { name: '取消' }).click()
    await expect(page.locator('main ol li').first()).toContainText('+1200')
    expect(fake.rpcCalls.filter((c) => c === 'save_record')).toHaveLength(1)
  })

  test('刪除需確認，資料庫為軟刪除', async ({ page, fake }) => {
    await createAndOpen(page)
    await page.getByRole('button', { name: '刪除' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
    expect(fake.rpcCalls).not.toContain('delete_record')

    await page.getByRole('button', { name: '刪除' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '刪除' }).click()
    await expect(page.getByText('還沒有任何紀錄')).toBeVisible()
    expect(fake.records[0].deleted_at).not.toBeNull()
  })

  test('名單：新增牌咖與場地，記錄時可以點選', async ({ page, fake }) => {
    await nav(page).getByRole('button', { name: '名單' }).click()
    await expect(page.getByRole('heading', { name: '牌咖與場地' })).toBeVisible()

    await page.getByLabel('新增牌咖').fill('  阿明 ')
    await page.getByRole('button', { name: '新增', exact: true }).click()
    await expect(page.getByLabel('新增牌咖')).toHaveValue('')
    await expect(page.getByText('尚未上桌')).toBeVisible()
    expect(fake.players.map((p) => p.name)).toEqual(['阿明'])

    // 重複的名字在前端就擋下
    await page.getByLabel('新增牌咖').fill('阿明')
    await page.getByRole('button', { name: '新增', exact: true }).click()
    await expect(page.getByText('「阿明」已在名單中')).toBeVisible()

    await page.getByRole('tab', { name: /場地/ }).click()
    await expect(page.getByText('還沒有場地')).toBeVisible()
    await page.getByLabel('新增場地').fill('阿明家')
    await page.getByRole('button', { name: '新增', exact: true }).click()
    await expect(page.getByText('阿明家')).toBeVisible()
    await page.getByLabel('新增場地').fill('麻將館')
    await page.getByRole('button', { name: '新增', exact: true }).click()
    await expect(page.getByRole('tab', { name: '場地（2）' })).toBeVisible()
    expect(fake.venues.map((v) => v.name)).toEqual(['阿明家', '麻將館'])

    // 新增紀錄：沒用過的場地不會預設帶入；點選後存檔
    await nav(page).getByRole('button', { name: '新增紀錄' }).click()
    await expect(page.locator('#record-venue')).toHaveValue('')
    const venueChips = page.getByLabel('場地名單').getByRole('button')
    await expect(venueChips).toHaveCount(2)
    await venueChips.filter({ hasText: '麻將館' }).click()
    await expect(page.locator('#record-venue')).toHaveValue('麻將館')
    await expect(venueChips.filter({ hasText: '麻將館' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByLabel('第 1 位玩家名字').click()
    await page.getByLabel('牌咖名單', { exact: true }).getByRole('button', { name: '阿明' }).click()
    await expect(page.getByLabel('第 1 位玩家名字')).toHaveValue('阿明')
    await fillRow(page, 0, { name: '阿明', score: '300', rounds: '1' })
    await fillRow(page, 1, { name: 'B', score: '-100', rounds: '1' })
    await fillRow(page, 2, { name: 'C', score: '-100', rounds: '1' })
    await fillRow(page, 3, { name: 'D', score: '-100', rounds: '1' })
    await page.getByRole('button', { name: '存檔' }).click()

    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
    await expect(page.getByText('📍 麻將館')).toBeVisible()
    expect(fake.records[0].venue).toBe('麻將館')

    // 下一筆預設帶入最近用過的場地
    await nav(page).getByRole('button', { name: '新增紀錄' }).click()
    await expect(page.locator('#record-venue')).toHaveValue('麻將館')

    await nav(page).getByRole('button', { name: '歷史紀錄' }).click()
    await expect(page.getByTestId('record-card')).toContainText('📍 麻將館')
  })

  test('記錄時輸入新場地會自動加入名單；可清除場地', async ({ page, fake }) => {
    await page.locator('#record-venue').fill('公司')
    await expect(page.getByText('新場地，存檔後會加入場地名單')).toBeVisible()
    await createAndOpen(page)
    expect(fake.venues.map((v) => v.name)).toEqual(['公司'])

    // 編輯時清除場地
    await page.getByRole('button', { name: '編輯' }).click()
    await expect(page.locator('#record-venue')).toHaveValue('公司')
    await page.getByRole('button', { name: '清除場地' }).click()
    await page.getByRole('button', { name: '儲存修改' }).click()
    await expect(page.getByText('未指定場地')).toBeVisible()
    expect(fake.records[0].venue).toBeNull()
  })

  test('刪除場地不影響已存的紀錄', async ({ page, fake }) => {
    await page.locator('#record-venue').fill('阿明家')
    await createAndOpen(page)
    await nav(page).getByRole('button', { name: '名單' }).click()
    await page.getByRole('tab', { name: /場地/ }).click()
    await page.getByRole('button', { name: '刪除 阿明家' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '移除' }).click()
    await expect(page.getByText('還沒有場地')).toBeVisible()
    expect(fake.venues).toHaveLength(0)

    await nav(page).getByRole('button', { name: '歷史紀錄' }).click()
    await expect(page.getByTestId('record-card')).toContainText('📍 阿明家')
  })

  test('少於 4 人時不能移除玩家', async ({ page }) => {
    await expect(page.getByTestId('player-row')).toHaveCount(4)
    await expect(page.getByRole('button', { name: '移除第 1 位玩家' })).toBeDisabled()
  })

  test('頁面沒有橫向捲動', async ({ page }) => {
    await page.getByRole('button', { name: '＋ 新增玩家' }).click()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test('其他裝置打開可以看到同一份紀錄（唯讀）', async ({ page, fake, browser }) => {
  await page.goto('/')
  await unlock(page)
  await createAndOpen(page)

  const other = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await fake.attach(other)
  const viewer = await other.newPage()
  await viewer.goto('/')
  await expect(viewer.getByTestId('standing').first()).toContainText('阿明')
  await viewer.getByRole('navigation').getByRole('button', { name: '歷史紀錄' }).click()
  await expect(viewer.getByTestId('record-card')).toContainText('阿明')
  await expect(viewer.getByRole('button', { name: '唯讀' })).toBeVisible()
  await other.close()
})

test('載入失敗時可以重試', async ({ page, fake }) => {
  fake.failReads = true
  await page.goto('/')
  // supabase-js 讀取失敗會自動重試 3 次（約 7 秒）才回報錯誤
  await expect(page.getByText('無法載入紀錄')).toBeVisible({ timeout: 15_000 })
  fake.failReads = false
  await page.getByRole('button', { name: '重試' }).click()
  await expect(page.getByText('還沒有任何紀錄')).toBeVisible()
})

test('總覽：戰績排行與牌咖、場地標籤', async ({ page, fake }) => {
  await page.goto('/')
  await unlock(page)
  await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()

  const save = async (venue: string, rows: Row[]) => {
    await nav(page).getByRole('button', { name: '新增紀錄' }).click()
    await page.locator('#record-venue').fill(venue)
    for (const [i, row] of rows.entries()) await fillRow(page, i, row)
    await page.getByRole('button', { name: '存檔' }).click()
    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
  }
  await save('樹窩', [
    { name: '阿明', score: '1200', rounds: '2' },
    { name: '小美', score: '-300', rounds: '2' },
    { name: '老王', score: '-500', rounds: '2' },
    { name: '阿華', score: '-400', rounds: '2' },
  ])
  await save('樹窩', [
    { name: '阿明', score: '-200', rounds: '3' },
    { name: '小美', score: '600', rounds: '3' },
    { name: '老王', score: '-100', rounds: '1' },
    { name: '阿華', score: '-300', rounds: '3' },
  ])
  // 手動加一個還沒上過桌的牌咖、一個還沒用過的場地
  await nav(page).getByRole('button', { name: '名單' }).click()
  await page.getByLabel('新增牌咖').fill('小陳')
  await page.getByRole('button', { name: '新增', exact: true }).click()
  await expect(page.getByText('尚未上桌')).toBeVisible()
  await page.getByRole('tab', { name: /場地/ }).click()
  await page.getByLabel('新增場地').fill('公司')
  await page.getByRole('button', { name: '新增', exact: true }).click()
  await expect(page.getByText('尚未使用')).toBeVisible()

  await nav(page).getByRole('button', { name: '總覽' }).click()
  await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
  await expect(page.locator('dl').first()).toContainText('總場數2 場')
  await expect(page.locator('dl').first()).toContainText('總將數5 將')

  const rows = page.getByTestId('standing')
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0)).toContainText('阿明')
  await expect(rows.nth(0)).toContainText('+1000')
  await expect(rows.nth(0)).toContainText('場數2')
  await expect(rows.nth(0)).toContainText('總將數5')
  await expect(rows.nth(0)).toContainText('勝率50%（1/2）')
  await expect(rows.nth(0)).toContainText('每將+200')
  await expect(rows.nth(1)).toContainText('小美')
  await expect(rows.nth(1)).toContainText('+300')
  await expect(rows.nth(3)).toContainText('阿華')
  await expect(rows.nth(3)).toContainText('-700')
  await expect(rows.nth(3)).toContainText('勝率0%（0/2）')

  const players = page.getByLabel('牌咖標籤')
  await expect(players.getByRole('listitem')).toHaveCount(5)
  await expect(players.getByRole('listitem').filter({ hasText: '阿明' })).toContainText('2 場')
  await expect(players.getByRole('listitem').filter({ hasText: '小陳' })).toContainText('0 場')
  const venues = page.getByLabel('場地標籤')
  await expect(venues.getByRole('listitem').filter({ hasText: '樹窩' })).toContainText('2 場')
  await expect(venues.getByRole('listitem').filter({ hasText: '公司' })).toContainText('0 場')
  void fake
})
