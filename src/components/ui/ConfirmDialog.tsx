import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Body, Title } from './Text';
import { Button } from './Button';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 p-6" onPress={onCancel}>
        <Pressable
          className="w-full max-w-md rounded-2xl bg-card dark:bg-card-dark border-2 border-border dark:border-border-dark p-6"
          onPress={(e) => e.stopPropagation()}
        >
          <Title className="text-xl">{title}</Title>
          <Body className="mt-2">{message}</Body>
          <View className="mt-6 flex-row justify-end gap-3">
            <Button title={t('common.cancel')} variant="secondary" onPress={onCancel} />
            <Button
              title={confirmLabel ?? t('common.confirm')}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
