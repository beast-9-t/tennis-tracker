<script setup lang="ts">
import { ref, watch } from 'vue';
import { Dialog, InputNumber, Button, Space } from 'tdesign-vue-next';
import { goalsApi } from '../api/client';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:visible': [visible: boolean];
  'goals-saved': [];
}>();

const weeklyTarget = ref<number>(4);
const monthlyTarget = ref<number>(16);
const version = ref(0);
const timezone = ref('Asia/Shanghai');
const isLoading = ref(false);
const errorMsg = ref('');

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    isLoading.value = true;
    errorMsg.value = '';
    try {
      const goals = await goalsApi.getCurrent();
      weeklyTarget.value = goals.weeklyTargetCount;
      monthlyTarget.value = goals.monthlyTargetCount;
      version.value = goals.version;
      timezone.value = goals.timezone;
    } catch (error) {
      errorMsg.value = error instanceof Error ? error.message : '目标加载失败';
    } finally {
      isLoading.value = false;
    }
  }
});

const handleSave = async () => {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    await goalsApi.update({
      weeklyTargetCount: weeklyTarget.value,
      monthlyTargetCount: monthlyTarget.value,
      timezone: timezone.value,
      version: version.value,
    });
    emit('update:visible', false);
    emit('goals-saved');
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '目标保存失败';
  } finally {
    isLoading.value = false;
  }
};

const handleCancel = () => {
  emit('update:visible', false);
};
</script>

<template>
  <Dialog
    :visible="visible"
    header="设置训练目标"
    width="400px"
    :confirm-btn="null"
    :cancel-btn="null"
    @close="handleCancel"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="space-y-6">
      <div v-if="errorMsg" class="p-2 rounded-lg bg-red-50 text-red-600 text-sm">{{ errorMsg }}</div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          本周目标（场次）
        </label>
        <InputNumber
          v-model="weeklyTarget"
          :min="1"
          :max="20"
          placeholder="请输入本周目标"
          size="large"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          本月目标（场次）
        </label>
        <InputNumber
          v-model="monthlyTarget"
          :min="1"
          :max="100"
          placeholder="请输入本月目标"
          size="large"
        />
      </div>

      <div class="text-sm text-gray-500">
        <p>💡 设置合理的目标可以帮助您更好地规划训练计划</p>
      </div>
    </div>

    <template #footer>
      <Space>
        <Button theme="default" @click="handleCancel">取消</Button>
        <Button theme="primary" :loading="isLoading" @click="handleSave">保存</Button>
      </Space>
    </template>
  </Dialog>
</template>

<style scoped>
.space-y-6 > * + * {
  margin-top: 1.5rem;
}
</style>
